/* =============================================================================
   اختفاء أدوات المشغّل — يقود `Media.player` الحقيقي بساعةٍ مزيَّفة.

   العطل: الإخفاء كان بـ`:hover` في CSS. على الفأرة يعمل، وعلى شاشة اللمس لا:
   المتصفّحات تُبقي حالة hover ملتصقةً بعد النقر، فتبقى الأدوات ظاهرة إلى
   الأبد فوق فيديو يُشاهَد بالعرض — وهذا ما اشتُكي منه.

   لماذا فحصٌ سلوكي لا نصّي: القاعدة الجديدة تعتمد على **توقيت** وعلى ترتيب
   الأحداث (اللمسة توقظ ثم تصل النقرة). قراءةُ المصدر تُثبت أن الشيفرة مكتوبة،
   لا أنها تفعل الصواب في التسلسل الصحيح.
   ============================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '..', '..', 'js') + '/';

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

// --- ساعة مزيَّفة ------------------------------------------------------------
// المؤقّتات هنا هي موضوع الفحص، فلا يجوز أن تُنتظر بالزمن الحقيقي: فحصٌ ينام
// ثلاث ثوانٍ لكل حالة يُهجَر بعد أسبوع.
let now = 1_000_000;
let seq = 0;
const timers = new Map();          // id → { at, fn, every }
global.setTimeout = (fn, ms) => { const id = ++seq; timers.set(id, { at: now + (ms || 0), fn }); return id; };
global.clearTimeout = (id) => timers.delete(id);
global.setInterval = (fn, ms) => { const id = ++seq; timers.set(id, { at: now + (ms || 0), fn, every: ms || 1 }); return id; };
global.clearInterval = (id) => timers.delete(id);
global.Date = class extends Date { static now() { return now; } };

/** يقدّم الساعة ويُطلق كل ما استحقّ في طريقه. */
function advance(ms) {
  const target = now + ms;
  for (;;) {
    let next = null;
    for (const [id, t] of timers) if (t.at <= target && (!next || t.at < next[1].at)) next = [id, t];
    if (!next) break;
    const [id, t] = next;
    now = t.at;
    if (t.every) t.at = now + t.every; else timers.delete(id);
    t.fn();
  }
  now = target;
}
const pending = () => timers.size;

// --- DOM يكفي لتشغيل المشغّل -------------------------------------------------
// شحيح كالمعتاد، لكنّ **المستمعين وclassList حقيقيان** — وهما بيت القصيد.
class El {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.attrs = {}; this.className = '';
    this._text = null; this._ls = {};
    this.style = { setProperty() {} };
  }
  get classList() {
    const self = this;
    const list = () => self.className.split(' ').filter(Boolean);
    return {
      add: (c) => { if (!list().includes(c)) self.className = [...list(), c].join(' '); },
      remove: (c) => { self.className = list().filter((x) => x !== c).join(' '); },
      contains: (c) => list().includes(c),
      toggle: (c, on) => (on ? self.classList.add(c) : self.classList.remove(c)),
    };
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(ev, fn) { (this._ls[ev] ||= []).push(fn); }
  dispatch(ev, e = {}) { (this._ls[ev] || []).forEach((fn) => fn({ preventDefault() {}, ...e })); }
  appendChild(c) { this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => c && this.children.push(c)); }
  replaceChildren(...cs) { this.children = cs.filter(Boolean); }
  get firstChild() { return this.children[0] ?? null; }
  set textContent(v) { this._text = v; this.children = []; }
  get textContent() { return this._text ?? ''; }
  set innerHTML(v) { this._html = v; }
  /** يدعم `.class` فقط — وهو كل ما تستعمله `media.js`. */
  querySelector(sel) {
    const c = sel.replace(/^\./, '');
    const walk = (n) => {
      for (const k of n.children || []) {
        if (k.className?.split(' ').includes(c)) return k;
        const deep = walk(k);
        if (deep) return deep;
      }
      return null;
    };
    return walk(this);
  }
}

global.window = global;
global.document = {
  createElement: (t) => new El(t),
  createElementNS: (ns, t) => new El(t),
  createTextNode: (t) => ({ nodeType: 3, data: String(t) }),
  addEventListener() {},
};
global.Node = El;
global.navigator = { onLine: true };
global.Store = { get: () => ({ username: 'أحمد' }) };
global.Api = { invoke: () => Promise.reject(new Error('لا شبكة في الفحص')) };
global.Device = { fingerprint: () => Promise.resolve('x') };

eval(fs.readFileSync(dir + 'ui.js', 'utf8'));
eval(fs.readFileSync(dir + 'data/media.js', 'utf8'));

// --- فيديو مزيَّف -------------------------------------------------------------
/** يبني مشغّلًا حقيقيًّا بمصدر محلّي (فلا شبكة)، ويعيد المقابض التي نقودها به. */
async function mount() {
  const box = await Media.player('demo', { local: 'blob:demo' });
  const el = box.children.find((c) => c.tagName === 'video');

  // `paused` يبدأ صحيحًا كالفيديو الحقيقي، ويتغيّر مع play/pause
  el.paused = true;
  el.duration = 60;
  el.currentTime = 0;
  el.play = () => { el.paused = false; el.dispatch('play'); return Promise.resolve(); };
  el.pause = () => { el.paused = true; el.dispatch('pause'); };
  el.buffered = { length: 0 };
  el.load = () => {};

  return {
    box, el,
    idle: () => box.classList.contains('is-idle'),
    seek: box.querySelector('.vc__seek'),
    // لمسة كاملة: المتصفّح يُطلق pointerdown على الحاوية ثم click على الفيديو
    tap: () => { box.dispatch('pointerdown'); el.dispatch('click'); },
  };
}

(async () => {
  // ===========================================================================
  // ١) العطل بعينه: أثناء التشغيل تختفي الأدوات بعد ثوانٍ
  // ===========================================================================
  {
    const v = await mount();
    ok('قبل التشغيل الأدوات ظاهرة', !v.idle());

    await v.el.play();
    ok('وعند التشغيل تبقى لحظةً', !v.idle());

    advance(1500);
    ok('ولا تختفي مبكّرًا', !v.idle());

    advance(2000);           // ٣٫٥ ثانية إجمالًا
    ok('ثم تختفي بعد سكون قصير', v.idle());
  }

  // ===========================================================================
  // ٢) اللمسة تُعيدها — ولا توقف الفيديو
  //    هذا الشرط هو الفرق بين إصلاحٍ وإزعاجٍ آخر: أن يدفع الطالب ثمن رؤية
  //    الشريط إيقافًا لم يطلبه.
  // ===========================================================================
  {
    const v = await mount();
    await v.el.play();
    advance(4000);
    ok('مخفيّة قبل اللمس', v.idle());

    v.tap();
    ok('اللمسة تُعيد الأدوات', !v.idle());
    ok('ولا توقف الفيديو', v.el.paused === false, `paused=${v.el.paused}`);

    advance(4000);
    ok('ثم تختفي ثانيةً بعد سكون', v.idle());

    // اللمسة التالية — والأدوات ظاهرة — تعمل عملها المعتاد
    v.tap();                                   // إظهار
    ok('واللمسة التي تليها تُظهر لا أكثر', !v.idle() && v.el.paused === false);
    v.tap();                                   // والآن إيقاف
    ok('ولمسةٌ والأدوات ظاهرة توقف الفيديو', v.el.paused === true);
  }

  // ===========================================================================
  // ٣) المتوقّف لا تختفي أدواته أبدًا
  // ===========================================================================
  {
    const v = await mount();
    await v.el.play();
    advance(4000);
    ok('مخفيّة أثناء التشغيل', v.idle());

    v.el.pause();
    ok('والإيقاف يُظهرها فورًا', !v.idle());

    advance(30_000);
    ok('وتبقى ظاهرة مهما طال التوقّف', !v.idle());
  }

  // ===========================================================================
  // ٤) لا تختفي تحت إصبع الطالب أثناء سحب المِزلاق
  // ===========================================================================
  {
    const v = await mount();
    await v.el.play();
    v.seek.value = '500';
    v.seek.dispatch('input');

    advance(10_000);
    ok('السحب يمنع الاختفاء', !v.idle());

    v.seek.dispatch('change');   // انتهى السحب
    advance(4000);
    ok('وبعد انتهائه يُستأنف العدّ', v.idle());
  }

  // ===========================================================================
  // ٥) نهاية الفيديو تُظهر الأدوات
  // ===========================================================================
  {
    const v = await mount();
    await v.el.play();
    advance(4000);
    v.el.paused = true;
    v.el.dispatch('ended');
    ok('الانتهاء يُظهر الأدوات', !v.idle());
  }

  // ===========================================================================
  // ٦) لا مؤقّت يبقى بعد إزالة المشغّل
  //    مؤقّت العلامة المائية سرّب من قبل؛ لا نكرّرها بمؤقّت الاختفاء.
  // ===========================================================================
  {
    const v = await mount();
    await v.el.play();
    ok('أثناء التشغيل ثمّة مؤقّتات', pending() > 0, String(pending()));

    /* `pause` هنا بلا حدث. أحداث الوسائط في المتصفّح تُصفّ كمهامّ لا تُطلق
       تزامنيًّا، فحين يعود `_dispose` لم يصل حدث `pause` بعد. ولولا هذا
       التدقيق لأخفى الفحصُ الحاجةَ إلى `_stopIdle`: `pause` التزامنيّة في
       المزيَّف كانت توقظ فتُلغي المؤقّت بالمصادفة، فيمرّ الفحص على شيفرة
       تُسرّب في المتصفّح. */
    v.el.pause = () => { v.el.paused = true; };

    v.box._dispose();
    ok('و`_dispose` لا يترك واحدًا', pending() === 0, String(pending()));
  }

  console.log('\n' + (bad ? `${bad} فشل` : 'اختفاء الأدوات سليم'));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + e.stack); process.exit(1); });
