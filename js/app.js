/* =============================================================================
   app.js — الإقلاع والتوجيه

   التطبيق يعمل على ثلاثة أجهزة بمنطق تنقّل واحد:
   على الهاتف واللوحي تنقّل هرمي (دفع/رجوع)، وعلى الحاسوب يُضاف شريط جانبي
   ثابت يقفز مباشرةً لأي قسم. السجل نفسه يخدم الاثنين.
   ============================================================================= */
window.App = (function () {
  const { h, icon } = UI;

  const stack = [];                 // [{ name, params }]
  let shell, rail, view;

  const cur = () => stack[stack.length - 1];

  function buildShell() {
    const root = document.getElementById('app');
    rail = h('aside.rail');
    view = h('main.view');
    root.replaceChildren(rail, view);
    shell = root;
  }

  // --- الشريط الجانبي (حاسوب فقط — مخفي بـ CSS دون ذلك) ----------------------
  const RAIL_ITEMS = [
    { id: 'home',     label: 'الرئيسية', ico: () => icon.home(20),
      go: () => go('home') },
    { id: 'lessons',  label: 'الدروس',   ico: () => icon.book(20),
      go: () => go('course', { tab: 'lessons' }) },
    { id: 'practice', label: 'تمارين',   ico: () => icon.pencil(20),
      go: () => go('course', { tab: 'practice' }) },
    { id: 'exams',    label: 'امتحانات', ico: () => icon.exam(20),
      go: () => go('course', { tab: 'exams' }) },
    { id: 'progress', label: 'تقدّمي',   ico: () => icon.chart(20),
      go: () => go('course', { tab: 'progress' }) },
    { id: 'account',  label: 'حسابي',    ico: () => icon.user(20),
      go: () => go('account') },
  ];

  function activeRailId() {
    const c = cur();
    if (!c) return null;
    if (c.name === 'course')   return c.params.tab || 'lessons';
    if (c.name === 'lesson')   return 'lessons';
    if (c.name === 'practice') return 'practice';
    if (c.name === 'exam' || c.name === 'result') return 'exams';
    return c.name;
  }

  function drawRail() {
    const s = Store.get();
    // شاشات ما قبل الدخول بلا شريط جانبي — لا معنى للتنقّل قبل وجود حساب
    if (['welcome', 'auth'].includes(cur().name)) {
      rail.replaceChildren();
      rail.style.display = 'none';
      return;
    }
    rail.style.display = '';

    const on = activeRailId();
    rail.replaceChildren(
      h('div.rail__brand',
        h('img', { src: 'assets/img/icon-192.png', alt: '', width: 40, height: 40,
                   style: 'border-radius:11px' }),
        h('div',
          h('div.rail__name', 'منهاجي'),
          h('div.rail__tag', 'منهاجك السوري بين يديك'))),

      ...RAIL_ITEMS.map((it) => h('button', {
        class: on === it.id ? 'is-on' : '',
        onclick: it.go,
      }, it.ico(), it.label)),

      h('div.rail__spacer'),
      h('div.rail__foot',
        s.activated ? `اشتراكك فعّال · متبقٍ ${UI.ar(s.daysLeft)} يومًا` : 'وضع التجربة',
        h('div', { style: 'margin-top:6px' },
          s.online ? 'متصل' : 'تعمل دون إنترنت')),
    );
  }

  function render() {
    // الطرد يتجاوز كل شيء: بلا جلسة حاليّة لا يرى الطالب محتوى أصلًا،
    // فإبقاؤه في الشاشة العادية يعرض له فراغًا بلا تفسير.
    if (Store.get().evicted && Api.isSignedIn()) {
      view.replaceChildren(Screens.evicted());
      rail.replaceChildren();
      rail.style.display = 'none';
      return;
    }
    const c = cur();
    const fn = Screens[c.name] || Screens.welcome;
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
  function startSync() {
    if (!Api.isSignedIn()) return;

    // المحتوى المخزَّن يظهر فورًا، ثم تُحدّثه المزامنة إن توفّرت شبكة
    Sync.applyStored();
    const after = (r) => { if (r) render(); };

    Sync.syncNow().then(after);
    setInterval(() => Sync.syncNow({ content: false }).then(after), 300_000);
    addEventListener('online', () => Sync.syncNow().then(after));

    // العودة إلى التطبيق أهمّ لحظة لفحص الجلسة: الطرد يحدث غالبًا بينما
    // الشاشة مغلقة، فيجب أن يعرف الطالب فور فتحها لا بعد خمس دقائق.
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') Sync.syncNow({ content: false }).then(after);
    });

    // آخر فرصة لإرسال ما تبقّى قبل إغلاق التطبيق
    addEventListener('pagehide', () => Sync.pushProgress());
  }

  function boot() {
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
    stack.push({ name: signedIn ? 'home' : 'welcome', params: {} });
    render();
    startSync();

    // service worker يعمل على http(s) فقط — يُتجاهل عند فتح الملف مباشرةً
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return { go, back, boot, render, drawRail };
})();

document.addEventListener('DOMContentLoaded', App.boot);
