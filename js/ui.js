/* =============================================================================
   ui.js — أدوات بناء العناصر
   بديل خفيف عن إطار عمل. القاعدة: نبني عُقد DOM حقيقية، ولا نستخدم innerHTML
   لإعادة الرسم — لأن ذلك يمسح تركيز المؤشر وما كتبه الطالب في حقول التمارين.
   ============================================================================= */
window.UI = (function () {

  /**
   * h('div.card', { onclick }, child, child)
   * الوسم يقبل اختصار الأصناف بنقطة: 'button.btn.btn--primary'
   */
  function h(spec, props, ...children) {
    const [tag, ...classes] = String(spec).split('.');
    const el = document.createElement(tag || 'div');
    if (classes.length) el.className = classes.join(' ');

    if (props && props.constructor === Object) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class')      el.className += (el.className ? ' ' : '') + v;
        else if (k === 'style') el.setAttribute('style', v);
        else if (k === 'html')  el.innerHTML = v;      // محتوى ثابت من بياناتنا فقط
        else if (k === 'text')  el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v === true)    el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    } else if (props !== undefined && props !== null) {
      children.unshift(props);
    }

    add(el, children);
    return el;
  }

  function add(el, kids) {
    for (const c of kids.flat(4)) {
      if (c === null || c === undefined || c === false || c === '') continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }

  /** نص فرنسي معزول اتجاهيًا داخل جملة عربية — `<bdi>` عنصرٌ صُنع للعزل */
  const fr = (t) => h('bdi.fr', { text: t });

  /* ===========================================================================
     عرض النصّ المختلط عربي/فرنسي

     المبدأ: **لا نحارب خوارزمية الاتجاه بتعبير نمطي — نعطيها بنية صحيحة.**

     الطريقة السابقة كانت تلتقط «مقاطع لاتينية» بتعبير نمطي وتعزلها. وهذا لا
     ينتهي: كل علامة ترقيم جديدة حالةٌ جديدة. وقد أثبت التشغيل على نصوص حقيقية
     ثلاثة إخفاقات في آنٍ واحد:

       « inoubliable » (صفة)   ⇐ القوس الفاتح خارج العزل فيطير للطرف الآخر
       — Grammaire :           ⇐ النقطتان خارج العزل فتقفزان لأقصى اليسار
       … الوحدة 3.             ⇐ رقمٌ عربيّ يُعزل خطأً كأنه فرنسي

     البديل ثلاث طبقات:

     ١. **اتجاه لكل سطر** (`dir` مضبوط من أوّل حرف قويّ). سطرٌ يبدأ بالفرنسية
        يصير LTR كاملًا بترقيمه وأرقامه، وسطرٌ عربي يبقى RTL. هذا وحده يحلّ
        الجمل الفرنسية الكاملة والأسطر المرقّمة والخيارات الفرنسية.

     ٢. **`<bdi>` للمقاطع داخل السطر العربي، ومعها ترقيمها الملاصق.** عنصرٌ
        صُنع لهذا: يعزل ويكتشف اتجاهه بنفسه. والأقواس والاقتباسات المحيطة
        تدخل داخله لا خارجه.

     ٣. **ماركداون بسيط** يُصيَّر عُقدًا لا نصًّا. `**عريض**` كانت تظهر حرفيًّا،
        والأسوأ أنها **تقطع** المقطع الفرنسي إلى ثلاثة فتتشتّت أشلاؤه.
     =========================================================================== */

  /** أوّل حرف قويّ يحدّد اتجاه السطر — نفس منطق `dir="auto"` في المتصفّح. */
  const RTL_CH = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
  const LTR_CH = /[A-Za-zÀ-ÖØ-öø-ÿĀ-ɏ]/;

  function lineDir(s) {
    for (const ch of String(s)) {
      if (RTL_CH.test(ch)) return 'rtl';
      if (LTR_CH.test(ch)) return 'ltr';
    }
    return null;                       // أرقام وترقيم فقط ⇒ يرث اتجاه أبيه
  }

  /* مقطع لاتيني **مع ما يلاصقه** من اقتباسات وأقواس وترقيم. الفرق عن السابق
     أن الأقواس والاقتباسات المحيطة جزءٌ من المقطع لا جيرانٌ له، فلا تبقى
     محايدةً في سياق عربي فتطير. */
  const RUN = new RegExp(
    '[«"(\\[]?\\s*'                               // قوس أو اقتباس فاتح (اختياري)
    + '[A-Za-zÀ-ÖØ-öø-ÿ\\u0100-\\u024F]'          // يبدأ بحرف لاتيني قطعًا
    + '[A-Za-zÀ-ÖØ-öø-ÿ\\u0100-\\u024F0-9\'’\\-–—./%\\s,;]*'
    + '[A-Za-zÀ-ÖØ-öø-ÿ\\u0100-\\u024F0-9.]?'
    + '\\s*[»")\\]]?'                             // قوس أو اقتباس مغلق
    + '\\s*[:؛!?]?',                              // ترقيم لاحق يلتصق بالمقطع
    'g');

  /** ماركداون سطريّ: **عريض** · *مائل* · `شيفرة`. يبني عُقدًا لا HTML. */
  const MD = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/;

  function inline(text, into) {
    for (const chunk of String(text).split(MD)) {
      if (!chunk) continue;
      if (/^\*\*[^*]+\*\*$/.test(chunk)) { runs(chunk.slice(2, -2), h('b'), into); continue; }
      if (/^\*[^*]+\*$/.test(chunk))     { runs(chunk.slice(1, -1), h('i'), into); continue; }
      if (/^`[^`]+`$/.test(chunk))       { runs(chunk.slice(1, -1), h('code'), into); continue; }
      runs(chunk, null, into);
    }
  }

  /**
   * يوزّع نصًّا على عُقد نصّية و`<bdi>` للمقاطع اللاتينية.
   *
   * المسافة عند حافّة المقطع **تُعاد إلى خارجه** لا تُشذَّب: التعبير النمطي
   * يبتلع ما يلاصق المقطع ليضمّ الأقواس، فلو شذّبنا الناتج وحسب لاختفت
   * المسافة معها فالتصق «1-» بما بعده. الحرف الذي يبتلعه العزل يجب أن يعود
   * إلى مكانه، وإلّا صار الإصلاح خللًا من نوع آخر.
   */
  function runs(text, wrap, into) {
    const host = wrap || into;
    const txt = (t) => host.appendChild(document.createTextNode(t));
    let last = 0;
    for (const m of String(text).matchAll(RUN)) {
      const seg = m[0];
      const lead = seg.match(/^\s*/)[0];
      const tail = seg.slice(lead.length).match(/\s*$/)[0];
      const core = seg.slice(lead.length, seg.length - tail.length);
      if (!core) continue;
      if (m.index > last) txt(text.slice(last, m.index));
      if (lead) txt(lead);
      host.appendChild(h('bdi.fr', { text: core }));
      if (tail) txt(tail);
      last = m.index + seg.length;
    }
    if (last < text.length) txt(text.slice(last));
    if (wrap) into.appendChild(wrap);
  }

  /**
   * يعيد عنصرًا واحدًا يحمل النصّ كاملًا بأسطره.
   *
   * كل سطر عنصرٌ مستقلّ باتجاهه هو — لا `<br>` داخل عنصر واحد. السبب أن
   * الاتجاه خاصّية عنصر لا خاصّية سطر: بـ`<br>` تُجبَر كل الأسطر على اتجاه
   * واحد، فينكسر سطرٌ فرنسي بين سطرين عربيين. وهذا بالضبط ما كان يقع في نصوص
   * القراءة وأوراق الفحص.
   */
  function rich(text, tag = 'div') {
    const box = h(tag);
    const lines = String(text ?? '').split('\n');
    lines.forEach((line) => {
      if (!line.trim()) { box.appendChild(h('div.rich__gap')); return; }
      const d = lineDir(line);
      const el = h('div.rich__l', d ? { dir: d } : {});
      inline(line, el);
      box.appendChild(el);
    });
    return box;
  }

  /**
   * نصّ درسٍ جاهز بصيغة HTML (يأتي من اللوحة كما هو).
   *
   * الجداول هي ما كان يكسر الصفحة: جدول التصحيح في درس «الكتابة» — وهو الدرس
   * الرابع في كل وحدة — أعرضُ من شاشة الهاتف، والجدول لا ينكمش دون أضيق
   * محتواه، فيسحب معه عمودَ الشبكة كلّه ويخرج الفيديو والعنوان عن الشاشة.
   *
   * نلفّ كل جدول بحاويةٍ تمرّر نفسها أفقيًا. اخترنا اللفّ لا `display:block`
   * على الجدول نفسه، لأن الثانية تُلغي تخطيط الجدول: تصير الأعمدة بعرض
   * محتواها ولا يعود الجدول يملأ السطر، فيبدو منكمشًا على الشاشات الواسعة.
   */
  const TABLE = /<table[\s\S]*?<\/table>/gi;
  function prose(html) {
    // اللفّ على النصّ لا على الشجرة: نصّ الدرس يصل HTML مولَّدًا من اللوحة،
    // وجداوله لا تتداخل أبدًا، فالمطابقة غير الجشعة كافية — وتبقى النتيجة
    // واحدة في المتصفّح وفي أدوات المعاينة، فلا نصلح شيئًا لا نراه.
    const wrapped = String(html ?? '')
      .replace(TABLE, (t) => `<div class="prose__scroll">${t}</div>`);
    return h('div.prose', { html: wrapped });
  }

  /**
   * نمط `object-position` من موضعٍ محفوظ — أو `null` فلا سمة أصلًا.
   *
   * القيمة تأتي من القاعدة وتُحقن في سمة `style`، فتُفحص هنا أيضًا لا في
   * القاعدة وحدها: جهازٌ زامن محتواه قبل إضافة القيد قد يحمل قيمةً لم تمرّ
   * عليه. والنمط الوحيد المقبول «رقم% رقم%» — ما عداه يُهمَل بلا أثر.
   */
  const focusStyle = (pos) =>
    (/^\d{1,3}% \d{1,3}%$/.test(String(pos || '')) ? `object-position:${pos}` : null);

  /** أرقام عربية شرقية — للعدّ في الواجهة العربية */
  const AR = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  const ar = (n) => String(n).replace(/[0-9]/g, (d) => AR[+d]);

  function svg(paths, size = 22, opts = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('width', size); el.setAttribute('height', size);
    el.setAttribute('fill', opts.fill || 'none');
    el.setAttribute('stroke', opts.stroke || 'currentColor');
    // ١٫٧٥ لا ٢: الوزن الأثقل يجعل الأيقونة تبدو غليظة بجانب خطّ عربي رفيع.
    // هذا وزن أيقونات iOS تقريبًا، وهو ما يعطيها الإحساس «النظيف».
    el.setAttribute('stroke-width', opts.width || 1.75);
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.innerHTML = paths;
    return el;
  }

  /**
   * مجموعة الأيقونات.
   * قاعدة: **الأيقونة تصف معناها لا شكل الزر.** أيقونة «صح» للرئيسية أو سهم
   * للدروس تجبر المستخدم على قراءة النص في كل مرة، فتفقد الأيقونة فائدتها.
   * كلها 24×24 بخطوط لا بمساحات مصمتة، لتتبع لون النص في الوضعين.
   */
  /**
   * مجموعة الأيقونات — بنمط SF Symbols: هندسة متناسقة، وزن خفيف (١٫٧٥)،
   * نهايات مدوّرة، وهامش بصري متساوٍ داخل شبكة ٢٤×٢٤.
   *
   * قاعدة: **الأيقونة تصف معناها لا شكل الزر.** أيقونة «صح» للرئيسية أو سهم
   * للدروس تجبر المستخدم على قراءة النص في كل مرة، فتفقد الأيقونة فائدتها.
   * كلها خطوط لا مساحات مصمتة، لتتبع لون النص في الوضعين.
   */
  const icon = {
    // --- تنقّل -----------------------------------------------------------------
    back:     (s) => svg('<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>', s),   // RTL: يشير يمينًا
    // «تابع/ادخل» — يشير يسارًا، أي اتجاه التقدّم في واجهة عربية
    // يمرّر opts: هذا السهم يُستعمل مرّة كعلامة قائمة رفيعة ومرّة كزرّ مستقلّ
    // يحتاج سماكة أعلى، فالوزن يُحدَّد عند الاستدعاء لا هنا.
    fwd:      (s, o) => svg('<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>', s, o),
    chevron:  (s) => svg('<path d="m5.5 9 6.5 6.5L18.5 9"/>', s),

    // --- أقسام التطبيق ---------------------------------------------------------
    home:     (s) => svg('<path d="M3.5 10.5 12 3.8l8.5 6.7"/>'
                       + '<path d="M5.8 9.6v9.1a2 2 0 0 0 2 2h8.4a2 2 0 0 0 2-2V9.6"/>'
                       + '<path d="M9.8 20.7v-5.1a2.2 2.2 0 0 1 4.4 0v5.1"/>', s),
    book:     (s) => svg('<path d="M12 7.2v13.3"/>'
                       + '<path d="M12 7.2C10.4 5.6 8.3 4.8 5.4 4.8H3.9a.9.9 0 0 0-.9.9v10.6c0 .5.4.9.9.9h1.5'
                       + 'c2.9 0 5 .8 6.6 2.3"/>'
                       + '<path d="M12 7.2c1.6-1.6 3.7-2.4 6.6-2.4h1.5c.5 0 .9.4.9.9v10.6c0 .5-.4.9-.9.9h-1.5'
                       + 'c-2.9 0-5 .8-6.6 2.3"/>', s),
    pencil:   (s) => svg('<path d="M4 20h3.4L19.1 8.3a2.4 2.4 0 0 0-3.4-3.4L4 16.6z"/>'
                       + '<path d="m14.6 6 3.4 3.4"/>', s),
    exam:     (s) => svg('<rect x="5" y="4.6" width="14" height="16.2" rx="3.2"/>'
                       + '<rect x="9" y="2.6" width="6" height="4" rx="1.8"/>'
                       + '<path d="m9.6 13.6 1.9 1.9 3.6-3.9"/>', s),
    chart:    (s) => svg('<path d="M5.5 20v-5.5"/><path d="M12 20V7.5"/><path d="M18.5 20v-8.5"/>', s),
    users:    (s) => svg('<circle cx="9.2" cy="8.4" r="3.4"/>'
                       + '<path d="M3 20.2a6.2 6.2 0 0 1 12.4 0"/>'
                       + '<path d="M16.2 5.4a3.4 3.4 0 0 1 0 6"/>'
                       + '<path d="M17.6 14.4A5.6 5.6 0 0 1 21 20.2"/>', s),

    /**
     * ترس — وليس شمسًا.
     * الشكل السابق كان دائرة وثمانية أشعّة، أي رسم الشمس حرفيًا، فكان زرّ
     * «حسابي» يُقرأ كمفتاح إضاءة. الفرق هنا أن الأسنان قصيرة وملتصقة بالمحيط
     * ضمن مسار مغلق واحد، لا خطوطًا شعاعية ممتدّة كما في `sun` أدناه.
     */
    settings: (s) => svg('<circle cx="12" cy="12" r="3.3"/>'
                       + '<path d="M19.5 12c0-.5-.05-1-.13-1.4l1.95-1.5-1.9-3.3-2.3.95a7.4 7.4 0 0 0-2.42-1.4'
                       + 'L14.35 3h-3.8l-.33 2.35a7.4 7.4 0 0 0-2.42 1.4l-2.3-.95-1.9 3.3L5.55 10.6'
                       + 'a7.6 7.6 0 0 0 0 2.8L3.6 14.9l1.9 3.3 2.3-.95a7.4 7.4 0 0 0 2.42 1.4L10.55 21h3.8'
                       + 'l.33-2.35a7.4 7.4 0 0 0 2.42-1.4l2.3.95 1.9-3.3-1.95-1.5c.08-.4.13-.9.13-1.4Z"/>', s),
    sun:      (s) => svg('<circle cx="12" cy="12" r="4"/>'
                       + '<path d="M12 2.6v2.1"/><path d="M12 19.3v2.1"/>'
                       + '<path d="M4.9 4.9 6.4 6.4"/><path d="m17.6 17.6 1.5 1.5"/>'
                       + '<path d="M2.6 12h2.1"/><path d="M19.3 12h2.1"/>'
                       + '<path d="m6.4 17.6-1.5 1.5"/><path d="m19.1 4.9-1.5 1.5"/>', s),
    moon:     (s) => svg('<path d="M20.7 13.4A8.7 8.7 0 1 1 10.6 3.3a6.8 6.8 0 0 0 10.1 10.1Z"/>', s),

    // --- حالات وأفعال ----------------------------------------------------------
    down:     (s) => svg('<path d="M12 4v11.4"/><path d="m7.9 11.6 4.1 4.1 4.1-4.1"/>'
                       + '<path d="M5 20h14"/>', s),
    check:    (s) => svg('<path d="m5 12.6 4.4 4.4L19 7.4"/>', s),
    clock:    (s) => svg('<circle cx="12" cy="12" r="9.2"/><path d="M12 6.8V12l3.4 2"/>', s),
    // --- قائمة «حسابي» ---
    menu:     (s) => svg('<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/>', s),
    cap:      (s) => svg('<path d="M12 4 2.6 8.4 12 12.8l9.4-4.4L12 4Z"/>'
                       + '<path d="M6.6 10.6v4.3c0 1.6 2.4 2.9 5.4 2.9s5.4-1.3 5.4-2.9v-4.3"/>', s),
    theme:    (s) => svg('<circle cx="12" cy="12" r="9"/>'
                       + '<path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/>', s),
    about:    (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.4"/><path d="M12 7.7h.01"/>', s),
    chat:     (s) => svg('<path d="M20.6 11.7c0 4.2-3.9 7.6-8.6 7.6a9.7 9.7 0 0 1-2.6-.35L4.4 20.4l1.5-4.3'
                       + 'a7.2 7.2 0 0 1-2.5-5.4C3.4 6.5 7.3 3.1 12 3.1s8.6 3.4 8.6 8.6Z"/>'
                       + '<path d="M8.9 11.4h.01M12 11.4h.01M15.1 11.4h.01"/>', s),
    shield:   (s) => svg('<path d="M12 3.2 5.2 6v5.4c0 4.1 2.8 7.5 6.8 9.4 4-1.9 6.8-5.3 6.8-9.4V6L12 3.2Z"/>'
                       + '<path d="m9.4 12.1 1.8 1.8 3.5-3.6"/>', s),
    phone:    (s) => svg('<rect x="7" y="2.6" width="10" height="18.8" rx="2.6"/>'
                       + '<path d="M10.8 18.6h2.4"/>', s),
    logout:   (s) => svg('<path d="M9.6 3.6H6.2A2.6 2.6 0 0 0 3.6 6.2v11.6a2.6 2.6 0 0 0 2.6 2.6h3.4"/>'
                       + '<path d="m15.6 8 4 4-4 4"/><path d="M19.6 12H9.2"/>', s),
    close:    (s) => svg('<path d="m6 6 12 12M18 6 6 18"/>', s),
    // مثلّث مصمت بزوايا مدوّرة — مثلّث حادّ الزوايا يبدو خشنًا بجانب دوائر ناعمة
    play:     (s) => svg('<path d="M9 6.9v10.2a1 1 0 0 0 1.53.85l8.2-5.1a1 1 0 0 0 0-1.7l-8.2-5.1A1 1 0 0 0 9 6.9Z"/>',
                         s, { fill: 'currentColor', stroke: 'currentColor', width: 1.2 }),
    wifiOff:  (s) => svg('<path d="M5.2 12.4a7.2 7.2 0 0 1 6.4-2.1"/>'
                       + '<path d="M2 8.6a11.4 11.4 0 0 1 8.6-3.2"/>'
                       + '<path d="M8.4 15.7a3.6 3.6 0 0 1 2-.8"/>'
                       + '<circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>'
                       + '<path d="M3.2 3.2 20.8 20.8"/>', s),
    sync:     (s) => svg('<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 3.6v5.2h-5.2"/>', s),
    bell:     (s) => svg('<path d="M18.2 9.4a6.2 6.2 0 1 0-12.4 0c0 4.2-1.6 5.6-1.6 5.6h15.6'
                       + 's-1.6-1.4-1.6-5.6Z"/>'
                       + '<path d="M13.7 19.4a2 2 0 0 1-3.4 0"/>', s),
    warn:     (s) => svg('<path d="M10.6 4.2 3 17.3a1.6 1.6 0 0 0 1.4 2.4h15.2a1.6 1.6 0 0 0 1.4-2.4L13.4 4.2'
                       + 'a1.6 1.6 0 0 0-2.8 0Z"/>'
                       + '<path d="M12 9.6v3.8"/>'
                       + '<circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/>', s),
    trophy:   (s) => svg('<path d="M8.4 20.8h7.2"/><path d="M12 17.2v3.6"/>'
                       + '<path d="M7.2 4h9.6v5.2a4.8 4.8 0 0 1-9.6 0Z"/>'
                       + '<path d="M16.8 5.2h2.8v1.6a3.2 3.2 0 0 1-3.2 3.2"/>'
                       + '<path d="M7.2 5.2H4.4v1.6a3.2 3.2 0 0 0 3.2 3.2"/>', s),

    // --- اللوحة ----------------------------------------------------------------
    /* --- أيقونات الشريط السفلي: ممتلئة لا خطّية -------------------------------
       بقيّة أيقونات التطبيق خطّية بوزن ١٫٧٥ على أرضية فاتحة، وهي مناسبة هناك.
       أمّا هنا فالأرضية بنفسجية مصمتة والحجم ٢٤px: الخطّ الأبيض الرفيع يذوب
       فيها، والشكل المصمت يُقرأ من لمحة. النمط نفسه — زوايا مستديرة وأشكال
       هندسية بسيطة — بلغة مناسبة للخلفية. */
    fHome:    (s) => svg('<path d="M11.05 2.9a1.5 1.5 0 0 1 1.9 0l7.2 5.9c.35.29.55.72.55 1.17V19.2'
                       + 'a1.8 1.8 0 0 1-1.8 1.8h-3.6a.9.9 0 0 1-.9-.9v-3.9a2.4 2.4 0 0 0-4.8 0v3.9'
                       + 'a.9.9 0 0 1-.9.9H5.1a1.8 1.8 0 0 1-1.8-1.8V9.97c0-.45.2-.88.55-1.17Z"/>',
                       s, { fill: 'currentColor', stroke: 'none' }),

    fGrid:    (s) => svg('<rect x="3" y="3" width="8" height="8" rx="2.6"/>'
                       + '<rect x="13" y="3" width="8" height="8" rx="2.6"/>'
                       + '<rect x="3" y="13" width="8" height="8" rx="2.6"/>'
                       + '<rect x="13" y="13" width="8" height="8" rx="2.6"/>',
                       s, { fill: 'currentColor', stroke: 'none' }),

    fChart:   (s) => svg('<rect x="3.2" y="12.4" width="4.4" height="8.4" rx="2.2"/>'
                       + '<rect x="9.8" y="6.6" width="4.4" height="14.2" rx="2.2"/>'
                       + '<rect x="16.4" y="9.6" width="4.4" height="11.2" rx="2.2"/>',
                       s, { fill: 'currentColor', stroke: 'none' }),

    /* بوصلة — بديل «حسابي» بالشريط السفلي بعد أن صار الحساب زرّ إعدادات
       بالترويسة (icon.settings). دائرة + إبرة رباعية، بنفس هندسة home/grid/
       chart (بدائيان هندسيّان بسيطان لا رسمًا تفصيليًا)، خطًّا هنا وامتلاءً
       بحلقة غليظة + إبرة مصمتة بـfNews أدناه — كبقية أزواج الأيقونات. */
    news:     (s) => svg('<circle cx="12" cy="12" r="9"/>'
                       + '<path d="M15.5 8.5 13.7 13.7 8.5 15.5 10.3 10.3 Z"/>', s),
    fNews:    (s) => svg('<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="2.6"/>'
                       + '<path d="M15.3 8.7 13.6 13.6 8.7 15.3 10.4 10.4 Z" fill="currentColor" stroke="none"/>',
                       s, { fill: 'currentColor', stroke: 'none' }),

    grid:     (s) => svg('<rect x="3.2" y="3.2" width="7.6" height="7.6" rx="2.2"/>'
                       + '<rect x="13.2" y="3.2" width="7.6" height="7.6" rx="2.2"/>'
                       + '<rect x="3.2" y="13.2" width="7.6" height="7.6" rx="2.2"/>'
                       + '<rect x="13.2" y="13.2" width="7.6" height="7.6" rx="2.2"/>', s),
    help:     (s) => svg('<circle cx="12" cy="12" r="9.2"/>'
                       + '<path d="M9.6 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2-2.5 3.7"/>'
                       + '<circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/>', s),
    video:    (s) => svg('<rect x="2.8" y="6" width="12.8" height="12" rx="3.2"/>'
                       + '<path d="m15.6 10.6 4.3-2.5a.9.9 0 0 1 1.3.8v6.2a.9.9 0 0 1-1.3.8l-4.3-2.5Z"/>', s),
    key:      (s) => svg('<circle cx="8.2" cy="15.8" r="4.2"/>'
                       + '<path d="m11.2 12.8 8.6-8.6"/>'
                       + '<path d="m17.2 6.8 2.2 2.2"/><path d="m14.6 9.4 2.2 2.2"/>', s),

    // --- أيقونات الموادّ: كل مادة بشكلها لا بأيقونة كتاب عامّة واحدة ------------
    // الوزن ١٫٧٥ الموحّد للمشروع، لا ١٫٥ كما وردت الأصول — لتبقى متّسقة مع
    // بقية الأيقونات على نفس الشاشة بدل أن تبدو أرفع منها.
    subjArabic:     (s) => svg('<path d="M12 19l7-7 3 3-7 7-3-3z"/>'
                             + '<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>'
                             + '<path d="M2 2l1.5 1.5"/>', s),
    subjBiology:    (s) => svg('<path d="M2 21c0-3 1.85-5.36 4.63-6C7 14.7 8 15.5 8 16.5c0 1.1-.9 2-2 2h-1"/>'
                             + '<path d="M22 3c0 3-1.85 5.36-4.63 6C17 8.7 16 7.9 16 6.9c0-1.1.9-2 2-2h1"/>'
                             + '<path d="M8 16.5a4.5 4.5 0 0 1 9-9"/>'
                             + '<path d="M10.5 14l3-3"/><path d="M7.5 11l3-3"/><path d="M13.5 17l3-3"/>', s),
    subjChemistry:  (s) => svg('<path d="M10 2v7.521C10 10.337 9.615 11.116 8.94 11.622L5 14.578'
                             + 'C4.367 15.054 4 15.803 4 16.598V20a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3.402'
                             + 'c0-.795-.367-1.544-1-2.02l-3.94-2.956c-.675-.506-1.06-1.285-1.06-2.101V2"/>'
                             + '<path d="M8 2h8"/><path d="M7 16h10"/>', s),
    subjEnglish:    (s) => svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>'
                             + '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'
                             + '<path d="M10 10l2-4 2 4"/><path d="M10 13h4"/>', s),
    subjFrench:     (s) => svg('<path d="M12 2L8 22h8L12 2z"/>'
                             + '<path d="M9 15h6"/><path d="M10 10h4"/><path d="M12 2v3"/>', s),
    subjGeography:  (s) => svg('<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/>'
                             + '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10'
                             + 'a15.3 15.3 0 0 1 4-10z"/>', s),
    subjHistory:    (s) => svg('<path d="M5 22h14"/><path d="M5 2h14"/>'
                             + '<path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>'
                             + '<path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>', s),
    subjMath:       (s) => svg('<path d="M4 7h6"/><path d="M4 17h6"/><path d="M7 4v6"/>'
                             + '<path d="M14 7h6"/><path d="M14 17h6"/><path d="M17 14v6"/>', s),
    subjNationalEdu:(s) => svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
                             + '<path d="M12 8v4"/><path d="M12 16h.01"/>', s),
    subjPhilosophy: (s) => svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>'
                             + '<path d="M19 12a7 7 0 1 0-7 7"/><path d="M12 9v4l3 2"/>', s),
    subjPhysics:    (s) => svg('<circle cx="12" cy="12" r="3"/>'
                             + '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)"/>'
                             + '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-45 12 12)"/>', s),
    subjReligion:   (s) => svg('<path d="M12 7v14"/><path d="M9 21h6"/>'
                             + '<path d="M8 7a4 4 0 1 1 8 0"/><path d="M12 3v4"/>', s),
  };

  /**
   * أيقونة كل مادة بحسب معرّفها. الفرنسي وحده حيّ على الإنتاج اليوم؛ البقية
   * جاهزة لبكالوريا وتاسع حين تُضاف الموادّ فعليًا (البنية المعتمدة: كل شيء
   * بمعرّف المادة، لا طبقة كورسات). معرّفٌ غير معروف يرجع لأيقونة الكتاب
   * العامّة بدل أن يكسر البطاقة.
   */
  const SUBJECT_ICON = {
    fr: icon.subjFrench, french: icon.subjFrench,
    en: icon.subjEnglish, english: icon.subjEnglish,
    ar: icon.subjArabic, arabic: icon.subjArabic,
    math: icon.subjMath,
    physics: icon.subjPhysics, chemistry: icon.subjChemistry,
    biology: icon.subjBiology,
    history: icon.subjHistory,
    geography: icon.subjGeography,
    philosophy: icon.subjPhilosophy,
    religion: icon.subjReligion,
    national_edu: icon.subjNationalEdu, natedu: icon.subjNationalEdu,
  };
  const subjectIcon = (code, s) => (SUBJECT_ICON[code] || icon.book)(s);

  /**
   * أيقونة المادة كصورة WebP جاهزة (رسم ثلاثي الأبعاد بدل خطوط). عولجت من
   * أصول خامة بخلفية خضراء لم تُزَل تمامًا (هالة شفافة باقية على كل الكانفاس)؛
   * قُصّت الهالة وحدود الشكل وصُغِّرت لحجم العرض الفعلي — ١١ أيقونة = ٧٦ ك.ب
   * إجمالًا، لا وزن الأصول الخام (~٣٠ م.ب). لا صورة لكل الموادّ بعد (الأحياء
   * مثلًا)؛ SUBJECT_IMG تحمل ما هو جاهز فقط، والباقي يقع على subjectIcon.
   */
  const SUBJECT_IMG = {
    fr: 'french', french: 'french',
    en: 'english', english: 'english',
    ar: 'arabic', arabic: 'arabic',
    math: 'math',
    physics: 'physics', chemistry: 'chemistry',
    history: 'history',
    geography: 'geography',
    philosophy: 'philosophy',
    religion: 'religion',
    national_edu: 'national_edu', natedu: 'national_edu',
  };
  /**
   * عنصر أيقونة المادة: صورة يرفعها الطاقم من اللوحة إن وُجدت (`remoteUrl`،
   * رابطٌ محلولٌ مسبقًا عبر `Api.publicUrl` — هذا الملف لا يعرف Supabase)،
   * وإلّا صورة WebP جاهزة إن وُجدت لهذا الرمز، وإلّا خطوط SVG أخيرًا.
   */
  function subjectIconEl(code, s = 20, remoteUrl) {
    // object-fit: contain — الصورة المرفوعة يدويًا بلا ضمان أنها مربّعة
    // مسبقًا مثل أصول SUBJECT_IMG المعالَجة؛ القصّ يشوّه أيقونة غير متوقَّعة.
    if (remoteUrl) return h('img',
      { src: remoteUrl, alt: '', width: s, height: s, loading: 'lazy', style: 'object-fit:contain' });
    const file = SUBJECT_IMG[code];
    return file
      ? h('img', { src: `assets/img/subjects/${file}.webp`, alt: '', width: s, height: s, loading: 'lazy' })
      : subjectIcon(code, s);
  }


  /** حلقة التقدّم — SVG بمحيط محسوب */
  function ring(percent, size = 64, stroke = 7) {
    const r = (size - stroke) / 2 - 1;
    const c = 2 * Math.PI * r;
    const off = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
    const box = h('div.ring', { style: `width:${size}px;height:${size}px` });
    box.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle class="ring__track" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}"></circle>
        <circle class="ring__fill"  cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}"
                stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"></circle>
      </svg>`;
    box.appendChild(h('div.ring__label', {
      style: `font-size:${Math.round(size * 0.23)}px`,
      text: ar(Math.round(percent)) + '٪',
    }));
    return box;
  }

  const bar = (pct, cls = '') =>
    h('div.bar' + (cls ? '.' + cls : ''), h('i', { style: `width:${Math.max(0, Math.min(100, pct))}%` }));

  /** يستبدل محتوى عنصر بعقدة جديدة */
  function mount(host, node) {
    host.replaceChildren(node);
    return node;
  }

  /* ===========================================================================
     سحب أفقي بالإصبع، على نموذج تصفّح الكتاب العربي: صفحته التالية تُقلَب
     من اليسار إلى اليمين. فالسحب يمينًا = تقدّم، ويسارًا = رجوع.

     ثلاثة شروط تمنع الإطلاق الكاذب — وكلٌّ منها لمشكلة حقيقية:
     ١) العتبة الأفقية 60px: نقرة على خيار تتحرّك بضعة بكسلات، فبلا عتبة يصير
        كل اختيار إجابة انتقالًا للسؤال التالي.
     ٢) الأفقي يفوق العمودي بمرّة ونصف: التمرير العمودي في سؤال طويل ينحرف
        أفقيًا بطبيعته، وبلا هذا الشرط يقفز السؤال أثناء القراءة.
     ٣) تجاهل ما بدأ داخل حاوية تمرّر أفقيًا (صفّ الكلمات، جدول): السحب هناك
        يخصّ الحاوية لا الصفحة.
     ولمسٌ بأكثر من إصبع يُلغى كلّه — تكبير بإصبعين ليس سحبًا. */
  function swipe(el, { onNext, onPrev } = {}) {
    let x0 = 0, y0 = 0, live = false;
    const scrollsX = (node) => {
      for (let n = node; n && n !== el; n = n.parentElement)
        if (n.scrollWidth > n.clientWidth + 4) return true;
      return false;
    };
    el.addEventListener('touchstart', (e) => {
      live = e.touches.length === 1 && !scrollsX(e.target);
      if (!live) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) live = false;
    }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (!live) return;
      live = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      (dx > 0 ? onNext : onPrev)?.();
    }, { passive: true });
    return el;
  }

  return { h, fr, rich, prose, ar, icon, subjectIcon, subjectIconEl, svg, ring, bar,
           mount, swipe, focusStyle };
})();
