/* =============================================================================
   app.js — الإقلاع والتوجيه

   التطبيق يعمل على ثلاثة أجهزة بمنطق تنقّل واحد:
   على الهاتف واللوحي تنقّل هرمي (دفع/رجوع)، وعلى الحاسوب يُضاف شريط جانبي
   ثابت يقفز مباشرةً لأي قسم. السجل نفسه يخدم الاثنين.
   ============================================================================= */
window.App = (function () {
  const { h, icon } = UI;

  const stack = [];                 // [{ name, params }]
  let shell, rail, view, tabbar;

  const cur = () => stack[stack.length - 1];

  function buildShell() {
    const root = document.getElementById('app');
    rail = h('aside.rail');
    view = h('main.view');
    tabbar = h('nav.tabbar');
    root.replaceChildren(rail, view, tabbar);
    shell = root;
  }

  /**
   * وجهات التنقّل الثلاث — تُرسم في **كلا** الشريط الجانبي (حاسوب) والشريط
   * السفلي (هاتف) من نفس المصدر، فلا يمكن أن يفترقا لاحقًا بالغلط.
   *
   * الدروس والتمارين والامتحانات لا تظهر هنا كوجهات مستقلة — هي أقسام داخل
   * المادة نفسها (التبويبات داخل شاشة المادة)، لا مستوى تنقّل عابر للمواد.
   * «حسابي» لم تعد وجهة تنقّل — صارت زر إعدادات بترويسة الرئيسية وموادّي
   * (icon.settings بـ components.js)، فأُخلي مكانها الرابع هنا لـ«آخر الأخبار».
   */
  // ico تأخذ مقاسًا: الشريط الجانبي يعرض أيقونة صغيرة بجانب نصّها، والشريط
  // السفلي يعرض الأيقونة وحدها فيحتاجها أكبر لتبقى هدفًا واضحًا للمس.
  // ico خطّية للشريط الجانبي (أرضية فاتحة) · fico ممتلئة للشريط السفلي
  // (أرضية بنفسجية مصمتة يذوب فيها الخطّ الأبيض الرفيع).
  const RAIL_ITEMS = [
    { id: 'home',     label: 'الرئيسية',    ico: icon.home,  fico: icon.fHome,
      go: () => go('home') },
    { id: 'subjects', label: 'موادّي',      ico: icon.grid,  fico: icon.fGrid,
      go: () => go('subjects') },
    { id: 'progress', label: 'تقدّمي',      ico: icon.chart, fico: icon.fChart,
      go: () => go('progress') },
    { id: 'news',     label: 'آخر الأخبار', ico: icon.news,  fico: icon.fNews,
      go: () => go('news') },
  ];

  function activeRailId() {
    const c = cur();
    if (!c) return null;
    // كل ما يجري داخل مادة (درس، تمرين، امتحان، نتيجة) ينتمي منطقيًا
    // لقسم «موادّي» لا «الرئيسية» — الرئيسية صارت واجهة اكتشاف/ترويج مستقلة.
    if (['course', 'lesson', 'practice', 'exam', 'result'].includes(c.name))
      return 'subjects';
    return c.name;
  }

  function drawRail() {
    const s = Store.get();
    // شاشة ما قبل الدخول بلا تنقّل — لا معنى له قبل وجود حساب
    if (cur().name === 'auth') {
      rail.replaceChildren();
      rail.style.display = 'none';
      tabbar.replaceChildren();
      tabbar.style.display = 'none';
      return;
    }
    rail.style.display = '';
    tabbar.style.display = '';

    const on = activeRailId();
    // الشريط الجانبي: أيقونة ٢٠ + نصّ
    const railBtn = (it) => h('button', {
      class: on === it.id ? 'is-on' : '',
      onclick: it.go,
    }, it.ico(20), it.label);

    /**
     * الشريط السفلي: أيقونة ٢٤ وحدها بلا نصّ.
     *
     * حذف النصّ يوجب أمرين: aria-label وإلّا صار الزرّ بلا اسم لقارئ الشاشة،
     * و title ليظهر عند الإبقاء بالفأرة على الحاسوب. وبلا نصّ يصير اللون
     * وحده هو الفارق بين النشط وغيره، فأضفنا نقطة تحت النشط في CSS.
     */
    const tabBtn = (it) => h('button', {
      class: on === it.id ? 'is-on' : '',
      onclick: it.go,
      'aria-label': it.label,
      'aria-current': on === it.id ? 'page' : null,
      title: it.label,
      // الأيقونة داخل span: الخلفية الدائرية للنشط تحتاج صندوقًا حقيقيًا،
      // والحشوة على <svg> مباشرةً غير موثوقة بين المتصفحات.
    }, h('span.tabbar__ico', it.fico(23)));

    rail.replaceChildren(
      h('div.rail__brand',
        h('img', { src: 'assets/img/icon-192.png', alt: '', width: 40, height: 40,
                   style: 'border-radius:11px' }),
        h('div',
          h('div.rail__name', 'منهاجي'),
          h('div.rail__tag', 'منهاجك السوري بين يديك'))),

      ...RAIL_ITEMS.map(railBtn),

      h('div.rail__spacer'),
      h('div.rail__foot',
        s.activated ? `اشتراكك فعّال · متبقٍ ${UI.ar(s.daysLeft)} يومًا` : 'وضع التجربة',
        h('div', { style: 'margin-top:6px' },
          s.online ? 'متصل' : 'تعمل دون إنترنت')),
    );

    tabbar.replaceChildren(...RAIL_ITEMS.map(tabBtn));
  }

  function render() {
    const s = Store.get();
    // الطرد يتجاوز كل شيء: بلا جلسة حاليّة لا يرى الطالب محتوى أصلًا،
    // فإبقاؤه في الشاشة العادية يعرض له فراغًا بلا تفسير.
    if (s.evicted && Api.isSignedIn()) {
      view.replaceChildren(Screens.evicted());
      rail.replaceChildren();
      rail.style.display = 'none';
      return;
    }

    /* الإيقاف المعلَن من الخادم يسبق كل شيء عدا الطرد.
       غرضه لحظة واحدة: عطلٌ فادح وصل الطلاب. بدونه يبقون أمام تطبيق مكسور
       بلا تفسير — وService Worker يخدم النسخة المخزَّنة، فحتى النشر المصحَّح
       لا يصلهم إلّا عند الفتحة التالية. رسالةٌ صريحة أرحم من صمتٍ مكسور. */
    if (s.appConfig?.halted) {
      view.replaceChildren(Screens.halted());
      tabbar.replaceChildren();
      tabbar.style.display = 'none';
      rail.replaceChildren();
      rail.style.display = 'none';
      return;
    }

    const c = cur();

    // تُحفَظ الشاشة الحالية لتُستأنف بعد تحديث الصفحة بدل العودة إلى
    // الرئيسية — لا معنى لحفظ شاشات ما قبل الدخول.
    if (s.signedIn && c.name !== 'auth') {
      Store.set({ route: { name: c.name, params: c.params || {} } });
    }

    const fn = Screens[c.name] || Screens.auth;
    view.replaceChildren(fn(c.params || {}));
    drawRail();
  }

  /**
   * go('lesson', { id })         يدفع شاشة فوق السجل
   * go('lesson', { id }, true)   يستبدل الحالية (بلا إضافة للسجل)
   */
  function go(name, params = {}, replace = false) {
    if (replace && stack.length) stack[stack.length - 1] = { name, params };
    else stack.push({ name, params });
    render();
  }

  function back() {
    if (stack.length > 1) stack.pop();
    render();
  }

  /**
   * المزامنة في الخلفية — لا شاشة تنتظرها.
   * تعمل عند: الإقلاع · عودة الاتصال · كل خمس دقائق · قبل إغلاق التطبيق.
   */
  async function startSync() {
    if (!Api.isSignedIn()) return;

    // المحتوى المخزَّن يظهر فورًا، ثم تُحدّثه المزامنة إن توفّرت شبكة
    // القراءة من IndexedDB غير متزامنة — ننتظرها قبل أول مزامنة
    await Sync.applyStored();

    /**
     * إعادة الرسم بعد مزامنة خلفية — بشرطين، وكلاهما لازم:
     *
     * ١. أن يكون شيء قد تغيّر فعلًا. كان الشرط `if (r)` فقط، و syncNow ترجع
     *    كائنًا عند كل نجاح، فكانت الشاشة تُعاد بناؤها دوريًا بلا سبب —
     *    ومع animation:fadeIn على .screen تبدو رجفةً/تحديثًا للتطبيق.
     *
     * ٢. ألّا يكون الطالب داخل شاشة تحمل حالة في الذاكرة. إعادة الرسم تبني
     *    الشاشة من الصفر: في الامتحان تعني **ضياع إجاباته وتصفير مؤقّته**،
     *    وفي الدرس والتمرين تعني القفز إلى أعلى الصفحة وفقدان موضعه.
     *    التغيير ليس عاجلًا — يظهر عند أول تنقّل، وذلك يكفي.
     */
    const STATEFUL = ['exam', 'result', 'practice', 'lesson'];
    const after = (r) => {
      if (!r) return;
      if (r.evicted) { render(); return; }   // الطرد يتجاوز كل شيء
      if (!r.changed) return;
      if (STATEFUL.includes(cur().name)) return;
      render();
    };

    // أول مزامنة يُنتظر انتهاؤها لإخفاء السبلاش — لذلك نُعيد وعدها
    const first = Sync.syncNow().then((r) => { after(r); return r; });
    setInterval(() => Sync.syncNow({ content: false }).then(after), 300_000);
    addEventListener('online', () => Sync.syncNow().then(after));

    // العودة إلى التطبيق أهمّ لحظة لفحص الجلسة: الطرد يحدث غالبًا بينما
    // الشاشة مغلقة، فيجب أن يعرف الطالب فور فتحها لا بعد خمس دقائق.
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') Sync.syncNow({ content: false }).then(after);
    });

    // آخر فرصة لإرسال ما تبقّى قبل إغلاق التطبيق
    addEventListener('pagehide', () => Sync.pushProgress());

    return first;
  }

  // ---------------------------------------------------------------------------
  // سبلاش الإقلاع
  // ---------------------------------------------------------------------------

  // قلم يكتب بحلقة لا نهائية — طابع «تعليمي» بدل مؤشّر تحميل عام. SVG ثابت
  // من عندنا، فاستعمال html هنا آمن (لا نصّ مستخدم يمرّ به).
  const PENCIL_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" class="pencil">
      <defs><clipPath id="pencil-eraser"><rect height="30" width="30" ry="5" rx="5"></rect></clipPath></defs>
      <circle transform="rotate(-113,100,100)" stroke-linecap="round" stroke-dashoffset="439.82" stroke-dasharray="439.82 439.82" stroke-width="2" stroke="currentColor" fill="none" r="70" class="pencil__stroke"></circle>
      <g transform="translate(100,100)" class="pencil__rotate">
        <g fill="none">
          <circle transform="rotate(-90)" stroke-dashoffset="402" stroke-dasharray="402.12 402.12" stroke-width="30" r="64" class="pencil__body1"></circle>
          <circle transform="rotate(-90)" stroke-dashoffset="465" stroke-dasharray="464.96 464.96" stroke-width="10" r="74" class="pencil__body2"></circle>
          <circle transform="rotate(-90)" stroke-dashoffset="339" stroke-dasharray="339.29 339.29" stroke-width="10" r="54" class="pencil__body3"></circle>
        </g>
        <g transform="rotate(-90) translate(49,0)" class="pencil__eraser">
          <g class="pencil__eraser-skew">
            <rect height="30" width="30" ry="5" rx="5" fill="var(--acc-lite)"></rect>
            <rect clip-path="url(#pencil-eraser)" height="30" width="5" fill="var(--acc-deep)"></rect>
            <rect height="20" width="30" fill="var(--surf3)"></rect>
            <rect height="20" width="15" fill="var(--brd2)"></rect>
            <rect height="20" width="5" fill="var(--brd)"></rect>
            <rect height="2" width="30" y="6" fill="rgba(30,24,50,.2)"></rect>
            <rect height="2" width="30" y="13" fill="rgba(30,24,50,.2)"></rect>
          </g>
        </g>
        <g transform="rotate(-90) translate(49,-30)" class="pencil__point">
          <polygon points="15 0,30 30,0 30" fill="var(--gold-soft)"></polygon>
          <polygon points="15 0,6 30,0 30" fill="var(--gold)"></polygon>
          <polygon points="15 0,20 10,10 10" fill="var(--tx)"></polygon>
        </g>
      </g>
    </svg>`;

  /**
   * يُظهر السبلاش ويعيد دالة إخفاء.
   *
   * خارج #app لا داخله: buildShell يستبدل محتوى #app كليًا، فسبلاش بداخله
   * كان سيُمحى في أول render قبل أن يُرى.
   */
  function showSplash() {
    const el = h('div.splash',
      h('div', { html: PENCIL_SVG }),
      h('div.splash__t', 'جارٍ التحميل'));
    document.body.appendChild(el);

    let done = false;
    return () => {
      if (done) return;
      done = true;
      el.classList.add('splash--out');
      // نزيله بعد التلاشي لا قبله — الإزالة الفورية تقطع الانتقال
      setTimeout(() => el.remove(), 400);
    };
  }

  function boot() {
    /* أوّل سطر عمدًا: عطلٌ في الإقلاع نفسه هو أخطر ما يقع، وتركيبُ المُبلِّغ
       بعده يعني أن العطل الوحيد الذي لا يُبلَّغ عنه هو أسوأها.

       ⚠️ `window.Report?.` لا `Report?.`: المعامل `?.` يحمي من قيمة فارغة لا
       من **معرّف غير مصرَّح**، فـ`Report?.install()` ترمي ReferenceError إن
       لم يُحمَّل report.js أصلًا — فيموت الإقلاع كلّه على سطره الأوّل. أي أن
       أداة المراقبة تصير هي العطل. البحث عبر `window` يعطي undefined بأمان
       فيبقى المُبلِّغ اختياريًّا حقًّا. كشفته مجموعتا splash/stuck. */
    window.Report?.install();

    const s = Store.get();
    document.documentElement.setAttribute('data-theme', s.theme);
    buildShell();

    // زر رجوع الهاتف يتنقّل داخل التطبيق بدل مغادرته
    history.pushState({ app: true }, '');
    addEventListener('popstate', () => {
      if (stack.length > 1) { back(); history.pushState({ app: true }, ''); }
    });

    // حالة الشبكة الحقيقية تتجاوز المحاكاة اليدوية في الإعدادات
    addEventListener('online',  () => { Store.set({ online: true });  drawRail(); });
    addEventListener('offline', () => { Store.set({ online: false }); drawRail(); });
    if (!navigator.onLine) Store.set({ online: false });

    // ظهور الشريط الجانبي أو اختفاؤه عند تغيّر عرض النافذة
    matchMedia('(min-width: 1100px)').addEventListener('change', drawRail);

    // الجلسة على السيرفر هي الحكم، لا علامة محلية قد تكون قديمة
    const signedIn = Api.isSignedIn() && s.signedIn;

    // استئناف آخر شاشة بعد تحديث الصفحة — بشرط أن تكون شاشة حقيقية موجودة
    // فعلًا (لا اسم قديم بقي من نسخة سابقة للتطبيق تغيّرت شاشاتها؛ ومنها
    // 'welcome' المحذوفة — مسار محفوظ باسمها يسقط هنا إلى الرئيسية بأمان).
    const r = s.route;
    const resumable = signedIn && r && Screens[r.name] && r.name !== 'auth';

    stack.push(resumable ? { name: r.name, params: r.params || {} }
                         : { name: signedIn ? 'home' : 'auth', params: {} });

    /**
     * السبلاش لمن سيرى محتوى فقط. شاشة الدخول جاهزة فورًا ولا تنتظر مزامنة،
     * فسبلاش فوقها تأخيرٌ بلا سبب.
     *
     * يُرفع قبل render ليغطّي البناء الأول كاملًا، ويُخفى عند أول ما يتحقّق
     * من: انتهاء أول مزامنة، أو مرور السقف الزمني. السقف ليس تجميلًا: بلا
     * إنترنت قد يبقى `fetch` معلّقًا طويلًا، فيُحبس الطالب خلف شاشة تحميل
     * بينما محتواه المخزَّن جاهز خلفها فعلًا.
     */
    const hide = signedIn ? showSplash() : null;

    /* ترتيب هذه الأسطر هو الإصلاح، لا محتواها. الصياغة السابقة كانت تحبس
       الطالب خلف «جارٍ التحميل» إلى الأبد في مسارين اثنين:

       ١) `settled = true` قبل `render()`: أي استثناء في الرسم يمنع `hide()`
          من العمل، وفي الوقت نفسه يكون السقف الزمني قد استُهلك — فيعود
          فورًا عند `if (settled) return`. الغطاء يبقى ولا شيء يرفعه.
       ٢) السقف كان يُسجَّل **بعد** `render()` و`startSync()`: استثناء في
          أيّهما ينهي `boot` قبل تسجيله، فلا سقف أصلًا.

       القاعدة الآن: السقف أولًا، والرفع مضمون مهما فعل الرسم. شاشةٌ نصف
       مبنيّة يراها الطالب ويستطيع الخروج منها؛ أما الغطاء الدائم فلا. */
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      /* هذه الـ`catch` الثلاث تبتلع أخطر ثلاثة أعطال في التطبيق: فشل الرسم
         الأول (الطالب يرى شاشة فارغة)، وفشل بدء المزامنة (يرى محتوًى قديمًا
         أو لا شيء)، وفشل الرسم بعدها. كانت تذهب إلى console.error لا يقرؤه
         أحد — فالعطل يُعرف من شكوى طالب إن اشتكى. تُبلَّغ الآن. */
      try { render(); } catch (e) {
        console.error('تعذّر رسم الشاشة بعد المزامنة', e);
        window.Report?.capture('رسم بعد المزامنة', e);
      }
      if (hide) hide();
    };
    if (hide) setTimeout(finish, 6000);

    try { render(); } catch (e) {
      console.error('تعذّر الرسم الأول', e);
      window.Report?.capture('الرسم الأول', e);
    }

    let first;
    try { first = startSync(); } catch (e) {
      console.error('تعذّر بدء المزامنة', e);
      window.Report?.capture('بدء المزامنة', e);
    }

    if (hide) { if (first) first.then(finish, finish); else finish(); }

    // service worker يعمل على http(s) فقط — يُتجاهل عند فتح الملف مباشرةً
    /* --- تحديث النسخة: إعادة تحميل مرّة واحدة عند وصول إصدار جديد ----------
       الـservice worker يخدم النسخة المخزَّنة، فالإصلاح المنشور لا يصل
       الطالب إلّا عند **الفتحة التالية** — ولو كان الإصلاح هو ما يمكّنه من
       الدخول أصلًا، بقي عالقًا بلا أن يعرف السبب. وقع هذا فعلًا: أُصلح طول
       كود التفعيل ونُشر، والهاتف ما زال يرفض الكود برسالة قديمة.

       `controllerchange` يقع حين يستولي عامل جديد (بعد skipWaiting في
       sw.js). نعيد التحميل عندها مرّة واحدة — والحارس `reloaded` ضروري:
       بلا هذا تعيد الصفحة تحميل نفسها بلا نهاية إن استولى عامل آخر بعدها. */
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      // وجود عامل مسبق يميّز «تحديث» عن «أوّل تثبيت»: `clients.claim()` يطلق
      // نفس الحدث في الحالتين، فبلا هذا التمييز تُعيد الصفحة تحميل نفسها
      // أمام زائر يفتح التطبيق لأوّل مرّة — بلا سبب يفهمه.
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloaded) return;
        reloaded = true;
        location.reload();
      });

      /* `updateViaCache: 'none'` يُلزم المتصفّح بسؤال الخادم عن sw.js بدل
         إعادة استعمال نسخته المخزَّنة. GitHub Pages يرسل
         `Cache-Control: max-age=600`، فبدون هذا قد لا يُفحص الملفّ أصلًا
         لعشر دقائق مهما أعاد الطالب التحميل — يبدو كأن النشر لم يحدث. */
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          // فحصٌ صريح عند كل إقلاع: المتصفّح يفحص sw.js من تلقائه لكن بتوقيت
          // لا نضمنه، وقد يخدم نسخته المخزَّنة هو أيضًا.
          reg.update().catch(() => {});
        })
        .catch(() => {});
    }
  }

  // اسم الشاشة الحالية — يرافق تقارير الأعطال. عطلٌ في «الدرس» غير عطلٍ في
  // «الرئيسية»، وبلا هذا السياق يصير التقرير رسالةً بلا مكان.
  const currentName = () => cur()?.name || null;

  return { go, back, boot, render, drawRail, currentName };
})();

document.addEventListener('DOMContentLoaded', App.boot);
