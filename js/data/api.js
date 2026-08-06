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

  /**
   * قراءة جدول عبر PostgREST.
   * الصلاحية تفرضها RLS على السيرفر — لا نمرّر أي شرط أمني من هنا.
   *   from('lessons', { select: '*', order: 'sort_order', gt: ['updated_at', iso] })
   */
  function from(table, { select = '*', order, limit, gt, eq, in: inFilter } = {}) {
    const q = new URLSearchParams({ select });
    if (order) q.set('order', order);
    if (limit) q.set('limit', String(limit));
    if (gt)    q.set(gt[0], `gt.${gt[1]}`);
    if (eq)    q.set(eq[0], `eq.${eq[1]}`);
    if (inFilter) q.set(inFilter[0], `in.(${inFilter[1].join(',')})`);
    return request(`/rest/v1/${table}?${q}`);
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
