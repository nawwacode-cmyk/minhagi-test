/* =============================================================================
   doc.js — عارض شرح الدرس (PDF)

   لماذا عارضٌ مبنيّ لا `<iframe>` على عارض المتصفّح: العارض الأصلي واجهةٌ
   إنجليزية بألوان المتصفّح داخل تطبيق عربي بنفسجي، وسفاري على iOS يعرض
   **الصفحة الأولى فقط** داخل iframe، وكثير من متصفّحات أندرويد تستبدل العرض
   بزرّ «تنزيل». ثلاثة أعطال تصيب طلابنا تحديدًا.

   ثلاثة قرارات تحكم هذا الملفّ:

   ١. **المكتبة تُحمَّل كسولًا.** ١٫٤ م.ب لا يجوز أن ينزّلها طالبٌ لن يفتح
      شرحًا مصوَّرًا. أوّل فتحةِ شرح تجلبها، وservice worker يخزّنها بعدها.

   ٢. **الصفحات تُرسم عند اقترابها من الشاشة** لا كلّها دفعةً واحدة. شرحٌ من
      عشرين صفحة برسمٍ كامل يجمّد هاتفًا اقتصاديًّا عشرات الثواني ويستهلك
      ذاكرةً تُسقط التبويب.

   ٣. **العرض يتبع عرض الحاوية.** حجمٌ ثابت بالبكسل يعني شرحًا لا يُقرأ على
      هاتف ٣٦٠ بكسل — والشرح هو الدرس نفسه، فتعذُّر قراءته تعذُّر الدرس.
   ============================================================================= */
window.Doc = (function () {
  const { h, icon, ar } = UI;

  const LIB = 'js/vendor/pdf.min.js';
  const WORKER = 'js/vendor/pdf.worker.min.js';

  let libp = null;                 // وعد التحميل، يُنشأ مرّة
  let live = null;                 // آخر عارضٍ بُني — يُنظَّف عند بناء التالي

  /** يحمّل pdf.js مرّة واحدة مهما تكرّر النداء. */
  function loadLib() {
    if (libp) return libp;
    libp = new Promise((resolve, reject) => {
      if (window.pdfjsLib) return resolve(window.pdfjsLib);
      const s = document.createElement('script');
      s.src = LIB;
      s.onload = () => {
        if (!window.pdfjsLib) return reject(new Error('تعذّر تحميل عارض الملفّات.'));
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
        resolve(window.pdfjsLib);
      };
      /* الفشل يُنسي الوعد: بلا هذا يبقى وعدٌ مرفوض في الذاكرة، فتفشل كل
         محاولةٍ لاحقة فورًا بلا أن تُعيد الجلب — وقد يكون الانقطاع لحظيًّا. */
      s.onerror = () => { libp = null; reject(new Error('تعذّر تحميل عارض الملفّات.')); };
      document.head.appendChild(s);
    });
    return libp;
  }

  /** رابط موقّع للشرح — نفس مسار الفيديو: خاصّ، مربوط بالجهاز، عشر دقائق. */
  async function fetchUrl(docId) {
    const res = await Api.invoke('media-url', {
      doc_ids: [docId],
      fingerprint: await Device.fingerprint(),
    });
    if (!res.ok) throw new Error(res.message || 'تعذّر تجهيز الشرح.');
    const got = (res.docs || [])[0];
    if (!got) throw new Error('الشرح غير متاح.');
    return got;
  }

  // ---------------------------------------------------------------------------
  // العارض
  // ---------------------------------------------------------------------------
  /**
   * يبني عارضًا لشرحٍ بعينه. يعود بعقدة جاهزة فورًا وتملأ نفسها لاحقًا —
   * فلا تنتظر الشاشةُ الشبكة، وهو نفس مبدأ بقيّة التطبيق.
   */
  function viewer(docId, { title } = {}) {
    /* آخر عارضٍ بُني يُنظَّف عند بناء التالي — نفس نمط `Media.player`.
       لا شيء في التطبيق يستدعي `_dispose` عند تبديل الشاشة (`render` تستبدل
       المحتوى فحسب)، فبلا هذا يترك كل درسٍ يُفتح مراقبَ تقاطعٍ ومستمعَ تحجيم
       ووثيقةَ PDF في الذاكرة إلى الأبد. والتطبيق لا يعرض شرحين معًا. */
    try { live?._dispose?.(); } catch { /* لا يمنع بناء الجديد */ }
    live = null;

    const box = h('div.doc');
    const pages = h('div.doc__pages');
    const pageLbl = h('span.doc__n', '—');
    let pdf = null;
    let zoom = 1;                  // مضاعف فوق «ملء العرض»
    let io = null;                 // مراقب الاقتراب
    let rendering = new Set();

    const status = (node) => box.replaceChildren(bar(), h('div.doc__state', node));

    // --- الشريط العلوي -------------------------------------------------------
    const zoomOut = h('button.doc__b', { 'aria-label': 'تصغير', onclick: () => setZoom(zoom / 1.25) },
      UI.svg('<path d="M4.5 12h15"/>', 18));
    const zoomIn = h('button.doc__b', { 'aria-label': 'تكبير', onclick: () => setZoom(zoom * 1.25) },
      UI.svg('<path d="M12 4.5v15"/><path d="M4.5 12h15"/>', 18));
    const full = h('button.doc__b', { 'aria-label': 'ملء الشاشة', onclick: toggleFull },
      UI.svg('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/>'
           + '<path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>', 18));

    function bar() {
      return h('div.doc__bar',
        h('span.doc__t', title || 'شرح الدرس'),
        h('span.grow'),
        pageLbl, zoomOut, zoomIn, full);
    }

    function toggleFull() {
      if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
      /* `requestFullscreen` قد يُرفض (iOS لا يدعمها للعناصر). البديل صنفٌ
         يملأ نافذة العرض — أقلّ من ملء الشاشة الحقيقي لكنه يعمل في كل مكان،
         والخروج منه بالزرّ نفسه. */
      if (box.requestFullscreen) box.requestFullscreen().catch(() => box.classList.toggle('is-max'));
      else box.classList.toggle('is-max');
    }

    function setZoom(z) {
      zoom = Math.min(4, Math.max(0.5, z));
      box.querySelectorAll('.doc__p').forEach((c) => { c.dataset.done = ''; });
      layout();
    }

    /** عرض الرسم بالبكسل — عرض الحاوية × التكبير × كثافة الشاشة. */
    function widthFor() {
      const w = pages.clientWidth || box.clientWidth || 360;
      return Math.max(240, w - 8) * zoom;
    }

    async function draw(canvas) {
      const n = Number(canvas.dataset.page);
      if (canvas.dataset.done === String(zoom) || rendering.has(n)) return;
      rendering.add(n);
      try {
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        /* الكثافة مقيَّدة بـ٢: على شاشة ٣× يصير الرسم تسعة أضعاف المساحة —
           ذاكرةٌ تُسقط التبويب على هاتفٍ اقتصادي بلا مكسبٍ يُرى بالعين. */
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const scale = (widthFor() / base.width) * dpr;
        const vp = page.getViewport({ scale });

        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        canvas.dataset.done = String(zoom);
      } catch { /* صفحةٌ تعذّر رسمها تبقى فارغة ولا تُسقط البقيّة */ }
      finally { rendering.delete(n); }
    }

    /** يعيد ضبط النسب ثم يرسم ما هو قريب من الشاشة. */
    function layout() {
      box.querySelectorAll('.doc__p').forEach((c) => {
        if (c.dataset.done !== String(zoom)) draw(c);
      });
    }

    async function start() {
      status(h('div.doc__load', UI.spinner ? UI.spinner() : null, h('span', 'جارٍ تجهيز الشرح…')));
      try {
        const [lib, got] = await Promise.all([loadLib(), fetchUrl(docId)]);
        pdf = await lib.getDocument({ url: got.url }).promise;

        pages.replaceChildren(...Array.from({ length: pdf.numPages }, (_, i) =>
          h('canvas.doc__p', { 'data-page': String(i + 1), 'aria-label': `صفحة ${ar(i + 1)}` })));

        box.replaceChildren(bar(), pages);
        pageLbl.textContent = `${ar(1)} / ${ar(pdf.numPages)}`;

        /* مراقبٌ واحد لكل الصفحات: يرسم ما اقترب، ويحدّث رقم الصفحة الظاهرة.
           `rootMargin` سخيّ عمدًا — الرسم يستغرق جزءًا من الثانية، فبدء
           التالية قبل وصولها يجعل التمرير متّصلًا بلا فراغ أبيض. */
        io = new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            draw(e.target);
            if (e.intersectionRatio > 0.5) {
              pageLbl.textContent = `${ar(Number(e.target.dataset.page))} / ${ar(pdf.numPages)}`;
            }
          }
        }, { root: null, rootMargin: '600px 0px', threshold: [0, 0.51] });

        box.querySelectorAll('.doc__p').forEach((c) => io.observe(c));
      } catch (e) {
        status(h('div.doc__err',
          icon.warn(20),
          h('span', e.message || 'تعذّر عرض الشرح.'),
          h('button.btn.btn--secondary.btn--sm', { onclick: start }, 'أعد المحاولة')));
        window.Report?.send('doc', `تعذّر عرض الشرح · ${docId}`, e?.stack);
      }
    }

    // تغيّر عرض النافذة يعيد الرسم — وإلّا بقي الشرح بعرض الشاشة السابق
    const onResize = () => { clearTimeout(onResize._t); onResize._t = setTimeout(setZoom.bind(null, zoom), 200); };
    window.addEventListener('resize', onResize);

    box._dispose = () => {
      try { io?.disconnect(); } catch { /* لا شيء */ }
      window.removeEventListener('resize', onResize);
      clearTimeout(onResize._t);
      try { pdf?.destroy?.(); } catch { /* لا شيء */ }
    };

    start();
    live = box;
    return box;
  }

  return { viewer, loadLib, fetchUrl };
})();
