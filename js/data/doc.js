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
  /* كل العارضين الأحياء. كان مفردًا فيكفي — ثم صار الدرس يعرض أكثر من ملفّ،
     فبناء الثاني كان يهدم الأوّل وهو معروضٌ أمام الطالب.

     ولا شيء في التطبيق يستدعي `_dispose` عند تبديل الشاشة (`render` تستبدل
     المحتوى فحسب)، فبلا تنظيفٍ يترك كل درسٍ يُفتح مراقبَ تقاطعٍ ومستمعَ تحجيم
     ووثيقةَ PDF في الذاكرة. المالك الآن قائمة الملفّات: فتحُ درسٍ جديد ينظّف
     عارضي الدرس السابق كلّهم. */
  const live = new Set();

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
    const box = h('div.doc');
    const pages = h('div.doc__pages');
    const pageLbl = h('span.doc__n', '—');
    let pdf = null;
    let zoom = 1;                  // مضاعف فوق «ملء العرض»
    let io = null;                 // مراقب الاقتراب
    let rendering = new Set();
    const visible = new Set();     // الصفحات القريبة من الشاشة — وحدها تُعاد بدقّة أعلى

    const status = (node) => box.replaceChildren(bar(), h('div.doc__state', node));

    /* --- الشريط العلوي ---------------------------------------------------
       بلا زرّي تكبير وتصغير: التكبير بالأصابع كما يتوقّعه كل من فتح ملفًّا
       على هاتفه، وزرّان يشغلان مساحة الشريط ليؤدّيا ما تؤدّيه حركةٌ معروفة.

       لكن حذفهما وحده لا يكفي: تكبيرُ المتصفّح يُمدّد صورةً منقّطة أصلًا
       فيصير النصّ ضبابيًّا. لذلك نتتبّع `visualViewport.scale` ونعيد الرسم
       بدقّةٍ أعلى — فالتكبير يزيد الوضوح لا الضبابية. */
    const full = h('button.doc__b', { 'aria-label': 'ملء الشاشة', onclick: toggleFull },
      UI.svg('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/>'
           + '<path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>', 18));

    function bar() {
      return h('div.doc__bar',
        h('span.doc__t', title || 'شرح الدرس'),
        h('span.grow'),
        pageLbl, full);
    }

    function toggleFull() {
      if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
      /* `requestFullscreen` قد يُرفض (iOS لا يدعمها للعناصر). البديل صنفٌ
         يملأ نافذة العرض — أقلّ من ملء الشاشة الحقيقي لكنه يعمل في كل مكان،
         والخروج منه بالزرّ نفسه. */
      if (box.requestFullscreen) box.requestFullscreen().catch(() => box.classList.toggle('is-max'));
      else box.classList.toggle('is-max');
    }

    /**
     * يعيد الرسم بدقّة تناسب تكبير الأصابع الحالي.
     *
     * **الظاهر فقط** لا كل الصفحات: مسحُ العلامة عن الجميع ثم رسمهم يعني
     * ملفًّا من عشرين صفحة يُرسم كاملًا بثلاثة أضعاف الدقّة — تجميدٌ مؤكّد
     * على هاتفٍ اقتصادي. وما يخرج عن الشاشة يُرسم حين يقترب منها كالعادة.
     */
    function applyPinch() {
      const s = Math.min(3, Math.max(1, window.visualViewport?.scale || 1));
      // عتبةٌ ربعية: تغيّرٌ طفيف لا يستحقّ إعادة رسمٍ يراها المستخدم تلعثمًا
      if (Math.abs(s - zoom) < 0.25) return;
      zoom = s;
      box.querySelectorAll('.doc__p').forEach((c) => { c.dataset.done = ''; });
      for (const c of visible) draw(c);
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

        /* النسبة تُثبَّت من مقاس الصفحة نفسها.

           كان لكل صفحة `min-height` مخمَّن في CSS قبل رسمها — رقمٌ لا علاقة
           له بمقاس الملفّ، فتحجز الصفحة ارتفاعًا خاطئًا ثم تتغيّر عند الرسم:
           تتزحزح الصفحات وتتداخل، ويبدو بعضها مقطوعًا.

           `aspect-ratio` يحجز الارتفاع **الصحيح** قبل أن تُرسم بكسل واحد،
           فلا قفزة ولا تداخل — وكل صفحة بنسبتها هي، لا بنسبة الأولى. */
        canvas.style.aspectRatio = `${base.width} / ${base.height}`;

        const ctx = canvas.getContext('2d');
        /* **هذا السطر هو ما كان يكسر الشرح.**

           `ctx.direction` قيمته الافتراضية `inherit`، والتطبيق كلّه `rtl` —
           فكان كل نداء `fillText` يرسمه pdf.js يُوضَع من اليمين إلى اليسار،
           فتنزاح كل مجموعة حروف عن موضعها المحسوب. النتيجة كلماتٌ متكسّرة
           ومتباعدة، **في العربية واللاتينية معًا** (وهذا ما دلّ على السبب:
           عطلُ تشكيلٍ عربي لا يمسّ «On fête ensemble»).

           والمواضع في PDF مطلقة ومحسوبة سلفًا، فلا شأن للمتصفّح باتجاهها:
           `ltr` هنا ليست لغةً بل «لا تتدخّل». */
        ctx.direction = 'ltr';

        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        canvas.dataset.done = String(zoom);
      } catch { /* صفحةٌ تعذّر رسمها تبقى فارغة ولا تُسقط البقيّة */ }
      finally { rendering.delete(n); }
    }

    async function start() {
      status(h('div.doc__load', UI.spinner ? UI.spinner() : null, h('span', 'جارٍ تجهيز الشرح…')));
      try {
        const [lib, got] = await Promise.all([loadLib(), fetchUrl(docId)]);
        /* هذان المساران **شرط صحّة العرض العربي لا تحسين**.

           بدون `cMapUrl` لا يفكّ pdf.js ترميز الخطوط من نوع CID — وهي الأغلب
           في ملفّات InDesign وWord العربية — فيرسم رموزًا بدل الحروف.
           وبدون `standardFontDataUrl` لا يجد بديلًا حين يعجز عن قراءة الخطّ
           المضمَّن، فيرسم بمقاييس خاطئة: الحروف تتباعد وتنكسر الكلمات داخل
           السطر. وهذا بعينه ما ظهر في أوّل تجربة.

           والملفّان يُجلبان **عند الحاجة فقط**: صفحةٌ لاتينية لا تطلب أيًّا
           منهما، فلا كلفة على من لا يحتاجها. */
        pdf = await lib.getDocument({
          url: got.url,
          cMapUrl: 'js/vendor/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'js/vendor/standard_fonts/',
        }).promise;

        /* نسبة الصفحة الأولى تُحجز لكل الصفحات قبل رسم أيٍّ منها: الملفّ
           الواحد صفحاته بمقاسٍ واحد في الغالب الأعمّ، فهذا يعطي ارتفاعًا
           صحيحًا فورًا بلا قراءة كل الصفحات (وقراءتها كلّها عند الفتح تُبطئ
           الظهور على هاتفٍ بطيء). وما شذّ منها يُصحَّح عند رسمه. */
        const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
        const ratio = `${first.width} / ${first.height}`;

        pages.replaceChildren(...Array.from({ length: pdf.numPages }, (_, i) =>
          h('canvas.doc__p', { 'data-page': String(i + 1), 'aria-label': `صفحة ${ar(i + 1)}`,
                               style: `aspect-ratio:${ratio}` })));

        box.replaceChildren(bar(), pages);
        pageLbl.textContent = `${ar(1)} / ${ar(pdf.numPages)}`;

        /* مراقبٌ واحد لكل الصفحات: يرسم ما اقترب، ويحدّث رقم الصفحة الظاهرة.
           `rootMargin` سخيّ عمدًا — الرسم يستغرق جزءًا من الثانية، فبدء
           التالية قبل وصولها يجعل التمرير متّصلًا بلا فراغ أبيض. */
        io = new IntersectionObserver((entries) => {
          for (const e of entries) {
            // الخروج يُزال أيضًا: مجموعةٌ تنمو ولا تنقص تجعل التكبير يعيد رسم
            // كل ما مرّ عليه الطالب منذ الفتح لا ما يراه الآن.
            if (!e.isIntersecting) { visible.delete(e.target); continue; }
            visible.add(e.target);
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

    /* تغيّر عرض النافذة (أو دوران الجهاز) يعيد الرسم — وإلّا بقي الشرح بعرض
       الشاشة السابق. ومؤجَّلٌ ٢٠٠ مللي: الدوران يُطلق عشرات الأحداث. */
    let t = null;
    const redraw = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        zoom = 0;                    // يُجبر `applyPinch` على تجاوز عتبة الربع
        applyPinch();
      }, 200);
    };
    window.addEventListener('resize', redraw);

    /* تكبير الأصابع: `visualViewport` هو ما يعرف مقدار التكبير الحقيقي —
       `window.resize` لا يُطلق عنده على أغلب الهواتف. وبلا هذا يبقى النصّ
       صورةً ممدَّدة ضبابية مهما كبّر الطالب. */
    const vv = window.visualViewport;
    const onPinch = () => { clearTimeout(t); t = setTimeout(applyPinch, 250); };
    vv?.addEventListener('resize', onPinch);

    box._dispose = () => {
      live.delete(box);
      try { io?.disconnect(); } catch { /* لا شيء */ }
      window.removeEventListener('resize', redraw);
      vv?.removeEventListener('resize', onPinch);
      clearTimeout(t);
      visible.clear();
      try { pdf?.destroy?.(); } catch { /* لا شيء */ }
    };

    start();
    live.add(box);
    return box;
  }

  /**
   * قائمة «ملفّات الدرس».
   *
   * لا تُفتح الملفّات كلّها معًا: كلٌّ بطاقةٌ ساكنة حتى يطلبها الطالب. درسٌ
   * بثلاثة ملفّات يعني ثلاث وثائق PDF في الذاكرة وثلاثة روابط موقّعة لو
   * فُتحت كلّها — على هاتفٍ اقتصادي ذلك ثقيل بلا سبب.
   *
   * وطريقان لكل ملفّ عن قصد: **ملء الشاشة** لمن يريد قراءةً مركّزة (وهو
   * الأنسب لملفٍّ طويل)، و**السهم** لمن يريد نظرةً سريعة بلا مغادرة الدرس.
   */
  function fileList(docs, { onFull } = {}) {
    /* درسٌ جديد ⇒ عارضو الدرس السابق يُهدمون. هذه هي نقطة التنظيف الوحيدة
       في التطبيق، إذ لا يستدعي شيءٌ `_dispose` عند تبديل الشاشة. */
    disposeAll();
    const wrap = h('div.files');

    for (const d of docs) {
      const body = h('div.file__body');           // يُملأ عند أوّل فتح فقط
      let open = false;
      let built = false;

      const chev = h('span.file__chev', UI.svg('<path d="m6 9 6 6 6-6"/>', 18));
      const toggle = () => {
        open = !open;
        wrap.classList.toggle('has-open', open);
        card.classList.toggle('is-open', open);
        if (open && !built) { built = true; body.replaceChildren(viewer(d.id, { title: d.title })); }
        /* العارض لا يُهدم عند الطيّ: إعادة بنائه تعني تنزيل الملفّ وترقيم
           صفحاته من جديد في كل فتحة. الإخفاء بـCSS أرخص، ومَن يغادر الدرس
           يهدمه `_dispose` على أي حال. */
      };

      const meta = [d.pages ? `${ar(d.pages)} صفحة` : null,
                    d.size ? `${ar(Math.round(d.size / 1024 / 102.4) / 10)} م.ب` : null]
        .filter(Boolean).join(' · ');

      const card = h('div.file',
        h('div.file__h',
          h('span.file__ico', UI.svg(
            '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/>'
            + '<path d="M14 3v5h5"/>', 19)),
          h('div.grow.min0',
            h('b.file__t', d.title),
            meta ? h('small.file__m', meta) : null),
          h('button.btn.btn--primary.btn--sm', {
            onclick: () => (onFull || openFull)(d),
          }, 'فتح'),
          h('button.file__b', { onclick: toggle, 'aria-label': 'عرض الصفحات هنا' }, chev)),
        body);

      wrap.appendChild(card);
    }
    return wrap;
  }

  /**
   * يفتح ملفًّا بملء الشاشة فوق كل شيء.
   *
   * طبقةٌ مستقلّة لا `requestFullscreen`: الأخيرة غير مدعومة للعناصر على iOS،
   * وزرٌّ لا يعمل على نصف الأجهزة أسوأ من غيابه. وزرّ رجوع الهاتف يغلقها —
   * وإلّا خرج الطالب من الدرس كلّه وهو يظنّ أنه يغلق الملفّ.
   */
  function openFull(doc) {
    const v = viewer(doc.id, { title: doc.title });
    const close = () => {
      layer.remove();
      try { v._dispose?.(); } catch { /* لا شيء */ }
      removeEventListener('popstate', onPop);
      document.documentElement.style.overflow = prevOverflow;
    };
    const onPop = () => close();

    const layer = h('div.docfull',
      h('div.docfull__h',
        h('button.doc__b', { onclick: close, 'aria-label': 'إغلاق' },
          UI.svg('<path d="m6 6 12 12M18 6 6 18"/>', 20)),
        h('span.docfull__t', doc.title)),
      v);

    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';   // لا تمرير خلف الطبقة
    document.body.appendChild(layer);
    try { history.pushState({ docFull: true }, ''); } catch { /* بيئة بلا history */ }
    addEventListener('popstate', onPop);
  }

  /** يهدم كل عارضٍ حيّ — يُنادى عند فتح درسٍ جديد. */
  function disposeAll() {
    for (const v of [...live]) { try { v._dispose?.(); } catch { /* لا شيء */ } }
    live.clear();
  }

  return { viewer, fileList, openFull, disposeAll, loadLib, fetchUrl };
})();
