/* =============================================================================
   api.js — طبقة الاتصال بـ Supabase

   لماذا عميل مكتوب بيدنا بدل مكتبة supabase-js؟
   المكتبة ١٢٠ كيلوبايت، ونحن نحتاج ثلاثة أشياء فقط: مصادقة، وقراءة جداول،
   واستدعاء دوال. كلها HTTP عادي. والتطبيق بلا خطوة بناء وبلا CDN (يجب أن
   يقلع بلا إنترنت)، فإضافة مكتبة تعني حزمها يدويًا وتحديثها يدويًا.

   ١٥٠ سطرًا هنا أخفّ وأوضح وتحت سيطرتنا.
   ============================================================================= */
window.Api = (function () {

  const URL_BASE = 'https://ybwkunmyqbbwnnuaufgc.supabase.co';
  // المفتاح العام آمن بالتصميم: RLS على قاعدة البيانات هي خط الدفاع،
  // لا سرّية هذا المفتاح. وُجد ليكون داخل التطبيق.
  const ANON = 'sb_publishable_6xSYPVKr2zBSaqnbTpWi4A_pO7MJuxU';

  const SESSION_KEY = 'manhaji.session.v1';

  // ---------------------------------------------------------------------------
  // الجلسة
  // ---------------------------------------------------------------------------
  let session = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }
  function save(s) {
    session = s;
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }

  const isSignedIn = () => !!session?.access_token;
  const userId = () => session?.user?.id ?? null;

  /** التوكن ينتهي بعد ساعة؛ نجدّده قبل ذلك بدقيقتين. */
  function expired() {
    if (!session?.expires_at) return false;
    return Date.now() > (session.expires_at * 1000) - 120_000;
  }

  async function refresh() {
    if (!session?.refresh_token) return false;
    try {
      const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!res.ok) { save(null); return false; }
      save(await res.json());
      return true;
    } catch { return false; }   // بلا شبكة: نُبقي الجلسة كما هي
  }

  async function authHeader() {
    if (session && expired()) await refresh();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  // ---------------------------------------------------------------------------
  // الطلبات
  // ---------------------------------------------------------------------------

  /** خطأ يحمل رسالة عربية جاهزة للعرض ورمزًا للتفريع البرمجي. */
  class ApiError extends Error {
    constructor(code, message, status) {
      super(message); this.code = code; this.status = status;
    }
  }

  async function request(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
    const h = { apikey: ANON, ...headers };
    if (auth) Object.assign(h, await authHeader());
    if (body !== undefined) h['Content-Type'] = 'application/json';

    let res;
    try {
      res = await fetch(URL_BASE + path, {
        method, headers: h,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('offline', 'لا يوجد اتصال بالإنترنت.', 0);
    }

    if (res.status === 204) return null;

    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }

    if (!res.ok) {
      // الدوال ترجع { code, message } بالعربية؛ PostgREST يرجع { message }
      const code = data?.code || 'http_' + res.status;
      const msg = data?.message || 'حدث خطأ غير متوقع.';
      throw new ApiError(code, msg, res.status);
    }
    return data;
  }

  /** استدعاء Edge Function. */
  const invoke = (name, body, opts = {}) =>
    request(`/functions/v1/${name}`, { method: 'POST', body: body ?? {}, ...opts });

  /* ---------------------------------------------------------------------------
     الترقيم إلزامي لا تحسين.

     PostgREST يقصّ كل استجابة عند `db-max-rows` (١٠٠٠ على مشروعنا) **بلا أي
     إشارة خطأ**: يرجع ٢٠٠ ومعه ١٠٠٠ صفّ وكأنها كل ما هناك. قِسنا الأثر على
     الإنتاج: جدول question_options فيه ١٣٠١ صفًّا، فكان ٣٠١ خيارًا لا يصل أي
     جهاز — أي ٩٧ سؤالًا من ٤١٣ تظهر للطالب **بلا خيارات إطلاقًا**، لا يستطيع
     حلّها ولا يفهم لماذا.

     نطلب صفحاتٍ متتالية، والسعة الفعلية **تُتعلَّم من أول صفحة** لا تُفترض:
     لو خُفِّض `db-max-rows` على السيرفر يومًا إلى ٥٠٠، بقي الترقيم صحيحًا بلا
     تعديل هنا. افتراضُ الرقم بدل تعلّمه هو ما يُعيد الخلل صامتًا بعد سنة.

     الثمن: طلبٌ إضافي واحد لكل جدول (الصفحة التي تُثبت النهاية). مقبول — السحب
     الكامل صار نادرًا أصلًا بعد بصمة `content_version`.
  --------------------------------------------------------------------------- */
  const PAGE = 1000;

  /**
   * قراءة جدول عبر PostgREST — بكل صفوفه.
   * الصلاحية تفرضها RLS على السيرفر — لا نمرّر أي شرط أمني من هنا.
   *   from('lessons', { select: '*', order: 'sort_order', gt: ['updated_at', iso] })
   */
  async function from(table, {
    select = '*', order, limit, gt, eq, in: inFilter,
    // مفتاح فريد يُذيَّل به الترتيب لتثبيت الترقيم. `id` يصلح لكل جداولنا عدا
    // exam_questions فمفتاحها مركّب ولا عمود id فيها إطلاقًا.
    pageKey = 'id',
  } = {}) {
    const q = new URLSearchParams({ select });
    if (gt)    q.set(gt[0], `gt.${gt[1]}`);
    if (eq)    q.set(eq[0], `eq.${eq[1]}`);
    if (inFilter) q.set(inFilter[0], `in.(${inFilter[1].join(',')})`);

    // حدٌّ صريح من المنادي = يريد هذا العدد بالضبط، فلا ترقيم
    if (limit) {
      if (order) q.set('order', order);
      q.set('limit', String(limit));
      return request(`/rest/v1/${table}?${q}`);
    }

    /* الترتيب الفريد شرطُ صحّة للترقيم لا تجميل: `sort_order` وحده غير فريد،
       وترتيبٌ غير فريد يجعل الخادم حرًّا في ترتيب المتساويات بين صفحة وأخرى —
       فيتكرّر صفّ ويسقط آخر بلا أي خطأ ظاهر. لذلك نذيّل ترتيب المنادي بمفتاح
       فريد دائمًا. */
    q.set('order', order ? `${order},${pageKey}` : pageKey);

    /* الصفحة التالية بالمفتاح لا بالإزاحة، حين يكون الترتيب هو المفتاح وحده.
       السبب من القياس: `OFFSET 9000` تحت RLS يعني تقييم السياسة على ٩٠٠٠ صفّ
       ثم رميها. على ١٠ صفحات ذلك ~٤٥٠٠٠ تقييم مهدور مقابل ٩٦٠٠ نافع — فكلفة
       السحب تصير تربيعية بعدد الصفحات لا خطّية. أمّا `id > آخر ما رأينا` فمسح
       مدًى على الفهرس: ثابتٌ مهما بعُدت الصفحة.

       وتُشترط وحدةُ عمود الترتيب: مع ترتيبٍ مركّب يحتاج الأمر مقارنة صفّية
       `(a,b) > (x,y)` لا يعبّر عنها PostgREST، فنُبقي الإزاحة هناك. */
    const keyset = !order && !pageKey.includes(',');

    const out = [];
    let full = null;            // سعة الصفحة كما تعلّمناها من الخادم
    let prevHead = null;        // أول صفّ في الصفحة السابقة
    let cursor = null;
    for (let offset = 0, pages = 0; ; pages++) {
      if (keyset && cursor !== null) q.set(pageKey, `gt.${cursor}`);
      const page = await request(`/rest/v1/${table}?${q}`, {
        headers: keyset
          ? { 'Range-Unit': 'items', Range: `0-${PAGE - 1}` }
          : { 'Range-Unit': 'items', Range: `${offset}-${offset + PAGE - 1}` },
      });
      if (!Array.isArray(page)) return page;   // خطأ أو شكل غير متوقَّع

      /* حارس ضدّ حلقة لا تنتهي: لو تجاهل وسيطٌ أو إعدادٌ ترويسة Range لعاد
         الخادم بالصفحة الأولى نفسها إلى الأبد، فيتضخّم المصفوف حتى يموت
         التبويب. نكتفي حينها بما وصل ونصرخ — الانهيار أسوأ من نقصٍ معلَن،
         و probe-pagination هو من يكشف النقص الحقيقي في التشغيل. */
      const head = page.length ? JSON.stringify(page[0]) : null;
      if (head !== null && head === prevHead) {
        console.error(`الخادم يتجاهل ترويسة Range على ${table} — قد تكون النتيجة ناقصة`);
        break;
      }
      prevHead = head;

      out.push(...page);
      if (!page.length) break;
      if (full === null) full = page.length;   // أول صفحة تحدّد السعة الفعلية
      if (page.length < full) break;           // صفحة أقصر ⇒ بلغنا النهاية
      offset += page.length;
      if (keyset) {
        cursor = page[page.length - 1][pageKey];
        // بلا مؤشّر لا سبيل للتقدّم — الرجوع للإزاحة أأمن من حلقةٍ تعيد نفسها
        if (cursor === undefined || cursor === null) {
          console.error(`${table}: عمود ${pageKey} غير مُنتقى، تعذّر الترقيم بالمفتاح`);
          break;
        }
      }

      if (pages >= 200) {                      // ٢٠٠ صفحة ≈ ٢٠٠ ألف صفّ
        console.error(`ترقيم ${table} تجاوز الحدّ المعقول — توقّفنا عند ${out.length} صفًّا`);
        break;
      }
    }
    return out;
  }

  /** كتابة صفوف. `onConflict` يجعلها upsert. */
  function upsert(table, rows, { onConflict, ignoreDuplicates = false } = {}) {
    const prefer = [
      'return=minimal',
      ignoreDuplicates ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates',
    ].join(',');
    const q = onConflict ? `?on_conflict=${onConflict}` : '';
    return request(`/rest/v1/${table}${q}`, {
      method: 'POST',
      body: Array.isArray(rows) ? rows : [rows],
      headers: { Prefer: prefer },
    });
  }

  const rpc = (fn, args = {}) =>
    request(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args });

  // ---------------------------------------------------------------------------
  // المصادقة: اسم مستخدم + كود
  // ---------------------------------------------------------------------------

  /**
   * تفعيل أو دخول. الدالة على السيرفر تميّز الحالتين:
   * حساب جديد ⇒ تستهلك الكود · حساب موجود ⇒ دخول بلا استهلاك.
   *
   * هذا ما يجعل إعادة تثبيت التطبيق ممكنة: كلمة المرور مشتقّة حتميًا من
   * (اسم المستخدم + الكود)، فلا شيء يُفقد بحذف التطبيق.
   */
  async function activate(username, code, fingerprint, platform) {
    const res = await invoke('activate',
      { username, code, fingerprint, platform }, { auth: false });
    if (res?.session) save(res.session);
    return res;
  }

  function signOut() { save(null); }

  /**
   * رابط صورة عامة (صور الأساتذة والبانرات) من دلو public-media.
   *
   * عام بلا توقيع عن قصد — هذه صور تسويقية يراها الطالب قبل أن يشترك، ورابطها
   * ثابت فيخزّنها المتصفح ويعرضها دون إنترنت. المحتوى المدفوع شيء آخر تمامًا:
   * الفيديو على R2 برابط موقّع عشر دقائق (راجع Edge Function media-url).
   *
   * نخزّن المسار في القاعدة ونركّب الرابط هنا، فتغيير نطاق المشروع لا يُبطل
   * كل صفّ مخزَّن.
   */
  const publicUrl = (path) =>
    path ? `${URL_BASE}/storage/v1/object/public/public-media/${path}` : null;

  return {
    URL_BASE, ANON, ApiError,
    isSignedIn, userId, session: () => session, refresh,
    request, invoke, from, upsert, rpc, publicUrl,
    activate, signOut,
  };
})();
