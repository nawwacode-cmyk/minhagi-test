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
    user:     (s) => svg('<circle cx="12" cy="8.4" r="3.9"/>'
                       + '<path d="M4.6 20.4a7.4 7.4 0 0 1 14.8 0"/>', s),
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

    fUser:    (s) => svg('<circle cx="12" cy="7.6" r="4.1"/>'
                       + '<path d="M12 14.2c-4.06 0-7.35 2.3-7.35 5.14 0 1.03.84 1.66 1.87 1.66h10.96'
                       + 'c1.03 0 1.87-.63 1.87-1.66 0-2.84-3.29-5.14-7.35-5.14Z"/>',
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
  };


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

  return { h, fr, rich, prose, ar, icon, svg, ring, bar, mount, swipe };
})();
