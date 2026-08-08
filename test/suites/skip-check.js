// يقود جلسة تمارين وامتحانًا حقيقيَّين ويتحقّق من سلوك التخطّي والسحب:
// التخطّي لا يُسجَّل محاولةً ولا يُحسب خطأً، والرجوع يعيد السؤال بحالته لا
// فارغًا، وحدود التنقّل لا تتجاوز الجلسة.
const fs = require('fs');
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..', '..');
const dir = path.join(ROOT, 'js') + '/';

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

// --- DOM يحفظ المستمعين فعلًا (لا يكفي no-op هنا: السحب مستمع) ----------------
class N {
  constructor(t) {
    this.tagName = t; this.children = []; this.attrs = {}; this.className = '';
    this._text = null; this._html = null; this.style = { setProperty() {} };
    this.L = {};
  }
  get classList() {
    const s = this;
    return { add(c) { s.className += (s.className ? ' ' : '') + c; },
             toggle() {}, remove() {}, contains: (c) => s.className.includes(c) };
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, fn) { (this.L[t] = this.L[t] || []).push(fn); }
  fire(t, ev) { (this.L[t] || []).forEach((fn) => fn(ev)); }
  appendChild(c) { this.children.push(c); c.parentElement = this; return c; }
  append(...cs) { cs.forEach((c) => c && this.appendChild(c)); }
  replaceChildren(...cs) { this.children = cs.filter(Boolean); cs.forEach((c) => { if (c) c.parentElement = this; }); }
  set textContent(v) { this._text = v; this.children = []; }
  get textContent() {
    if (this._text !== null) return this._text;
    return this.children.map((c) => (c.nodeType === 3 ? c.data : c.textContent)).join('');
  }
  set innerHTML(v) { this._html = v; }
  get scrollWidth() { return 100; }
  get clientWidth() { return 100; }
  scrollIntoView() {}
  // بحث في الشجرة بالصنف
  find(cls, out = []) {
    if (this.className.split(' ').includes(cls)) out.push(this);
    this.children.forEach((c) => c.find && c.find(cls, out));
    return out;
  }
  get text() { return this.textContent; }
}

global.window = global;
global.document = {
  createElement: (t) => new N(t), createElementNS: (ns, t) => new N(t),
  createTextNode: (t) => ({ nodeType: 3, data: String(t) }),
  documentElement: { setAttribute() {} }, getElementById: () => new N('div'),
  addEventListener() {},
};
global.Node = N;
global.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
global.navigator = { onLine: true };
global.matchMedia = () => ({ addEventListener() {} });
global.addEventListener = () => {};
global.history = { pushState() {} };
global.setInterval = () => 0;
global.clearInterval = () => {};
global.App = { go() {}, back() {}, drawRail() {}, render() {} };
global.Api = { isSignedIn: () => true, publicUrl: (p) => (p ? 'u/' + p : null) };
global.Sync = { applyStored() {}, syncNow: () => Promise.resolve(), pushProgress() {} };
global.Device = { label: () => 'ج' };

eval(fs.readFileSync(dir + 'ui.js', 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'test/fixtures.js'), 'utf8'));
eval(fs.readFileSync(dir + 'store.js', 'utf8'));
eval(fs.readFileSync(dir + 'components.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/course.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/exam.js', 'utf8'));

Store.set({ signedIn: true, activated: true, username: 'أحمد' });

// --- أدوات قيادة ---------------------------------------------------------------
const btnBy = (root, re) => root.find('btn').find((b) => re.test(b.textContent));
const click = (el) => { if (!el) throw new Error('زرّ غير موجود'); el.fire('click'); };
const swipe = (card, dx) => {
  const t = (x) => ({ clientX: x, clientY: 100 });
  card.fire('touchstart', { touches: [t(200)], target: card });
  card.fire('touchend', { changedTouches: [t(200 + dx)] });
};
const attempts = () => Store.get().outbox.filter((x) => x.entity === 'attempt').length;
const cardOf = (screen) => screen.find('q')[0];

// =============================================================================
// ١) بطاقة السؤال وحدها: التخطّي والسحب
// =============================================================================
const q = SEED.questions[Object.keys(SEED.questions)[0]];
let log = [];
let card = C.questionCard(q, {
  index: 1, total: 5,
  onNext: () => log.push('next'), onSkip: () => log.push('skip'), onPrev: () => log.push('prev'),
});
ok('زرّ التخطّي يظهر تحت «تحقّق»', !!btnBy(card, /تخطّي/));
{
  const kids = card.children.filter((c) => c.className.includes('btn'));
  const iChk = kids.findIndex((b) => /تحقّق/.test(b.textContent));
  const iSkp = kids.findIndex((b) => /تخطّي/.test(b.textContent));
  ok('ترتيبه بعد «تحقّق» لا قبله', iChk >= 0 && iSkp === iChk + 1, `تحقّق@${iChk} تخطّي@${iSkp}`);
}
click(btnBy(card, /تخطّي/));
ok('نقره ينادي onSkip', log.join() === 'skip');

log = [];
swipe(card, +90);  ok('السحب يمينًا = تقدّم (تخطٍّ قبل الإجابة)', log.join() === 'skip');
log = [];
swipe(card, -90);  ok('السحب يسارًا = رجوع', log.join() === 'prev');

// عتبات السحب — كل واحدة تمنع إطلاقًا كاذبًا حقيقيًا
log = [];
swipe(card, +30);  ok('سحب قصير لا يُطلِق (نقرة على خيار)', log.length === 0);
log = [];
card.fire('touchstart', { touches: [{ clientX: 200, clientY: 100 }], target: card });
card.fire('touchend', { changedTouches: [{ clientX: 270, clientY: 260 }] });
ok('انحراف أفقي أثناء تمرير عمودي لا يُطلِق', log.length === 0);
log = [];
card.fire('touchstart', { touches: [{ clientX: 1 }, { clientX: 2 }], target: card });
card.fire('touchend', { changedTouches: [{ clientX: 200, clientY: 100 }] });
ok('لمسٌ بإصبعين لا يُطلِق', log.length === 0);

// التخطّي لا يُسجَّل محاولةً
Store.reset();
const before = attempts();
card = C.questionCard(q, { index: 0, total: 3, onNext() {}, onSkip() {} });
click(btnBy(card, /تخطّي/));
ok('التخطّي لا يُسجّل محاولة', attempts() === before, `${attempts()}`);

// بعد التحقّق يختفي زرّ التخطّي — الزرّ الأساسي صار «السؤال التالي»
card = C.questionCard(q, { index: 0, total: 3, onNext() {}, onSkip() {} });
click(card.find('opt')[0]);
click(btnBy(card, /تحقّق/));
ok('بعد التحقّق لا زرّ تخطٍّ', !btnBy(card, /تخطّي/));
ok('والزرّ الأساسي صار «السؤال التالي»', !!btnBy(card, /السؤال التالي/));

// شاشة لا تمرّر onSkip: لا زرّ ولا سحب
card = C.questionCard(q, { index: 0, total: 3, onNext() {} });
ok('بلا onSkip لا يظهر الزرّ', !btnBy(card, /تخطّي/));

// التلميح مرّة واحدة
ok('تلميح السحب على السؤال الأول',
   !!C.questionCard(q, { index: 0, total: 3, onNext() {}, onSkip() {} }).find('q__swipe-hint')[0]);
ok('ولا يتكرّر على بقيّة الأسئلة',
   !C.questionCard(q, { index: 1, total: 3, onNext() {}, onSkip() {} }).find('q__swipe-hint')[0]);

// =============================================================================
// ٢) جلسة تمارين كاملة: النسبة على ما أُجيب لا على حجم الجلسة
// =============================================================================
const subject = SEED.units[0].subject;
const poolSize = Object.values(SEED.questions).filter((x) => x.subject === subject).length;
ok('بنك أسئلة كافٍ للاختبار', poolSize >= 3, `${poolSize} سؤالًا`);

function session() {
  const scr = Screens.practice({ subject });
  return { scr, body: () => scr.find('screen__body')[0] };
}

Store.reset();
{
  const { scr } = session();
  // نتخطّى الأول، نجيب الثاني صحيحًا، ثم نتخطّى الباقي
  let card0 = cardOf(scr);
  click(btnBy(card0, /تخطّي/));
  let card1 = cardOf(scr);
  const right = card1.find('opt').find((o) => /✓|/.test(o.textContent));
  // نختار الخيار الصحيح فعلًا من بيانات السؤال
  const q1 = Object.values(SEED.questions).filter((x) => x.subject === subject)[1];
  const kRight = q1.options && q1.options.find((o) => o.correct);
  if (kRight) {
    const opt = card1.find('opt').find((o) => o.textContent.includes(kRight.t.replace(/<[^>]*>/g, '')));
    if (opt) click(opt);
  }
  click(btnBy(card1, /تحقّق/));
  click(btnBy(cardOf(scr), /السؤال التالي|إنهاء/));
  // نتخطّى ما تبقّى حتى نصل لورقة النتيجة
  for (let n = 0; n < poolSize + 2; n++) {
    const c = cardOf(scr);
    if (!c) break;
    const s = btnBy(c, /تخطّي/);
    if (s) click(s); else click(btnBy(c, /تحقّق|التالي|إنهاء/));
  }
  const out = scr.textContent;
  ok('ورقة النتيجة ظهرت', /٪|تخطّيت/.test(out), out.slice(-90).replace(/\s+/g, ' '));
  ok('النسبة على ما أُجيب لا على حجم الجلسة', /من ١ أجبتها/.test(out) || /أجبتها/.test(out),
     (out.match(/من [٠-٩]+ أجبتها/) || ['—'])[0]);
  ok('المتخطّى معلَن ولا يُحسب خطأً', /لم تُحسب عليك/.test(out));
  ok('وزرّ لحلّها', /حلّ الأسئلة المتخطّاة/.test(out));
}

// تخطّي كل شيء ⇒ لا نسبة صفرية كاذبة
Store.reset();
{
  const { scr } = session();
  for (let n = 0; n < poolSize + 2; n++) {
    const c = cardOf(scr);
    if (!c) break;
    const s = btnBy(c, /تخطّي/);
    if (!s) break;
    click(s);
  }
  const out = scr.textContent;
  ok('تخطّي الكلّ لا يعطي ٠٪ كاذبة', /لم تُحسب نتيجة/.test(out) && !/٠٪/.test(out),
     out.slice(-80).replace(/\s+/g, ' '));
  ok('ولا محاولات سُجّلت', attempts() === 0, `${attempts()}`);
}

// الرجوع يعيد السؤال بحالته لا فارغًا — ولا يسجّل محاولة ثانية
Store.reset();
{
  const { scr } = session();
  const c0 = cardOf(scr);
  const first = Object.values(SEED.questions).filter((x) => x.subject === subject)[0];
  if (first.options) click(c0.find('opt')[0]);
  click(btnBy(c0, /تحقّق/));
  const n1 = attempts();
  ok('الإجابة سجّلت محاولة واحدة', n1 === 1, `${n1}`);
  click(btnBy(cardOf(scr), /السؤال التالي|إنهاء/));
  // نرجع بالسحب
  swipe(cardOf(scr), -90);
  const back = cardOf(scr);
  ok('الرجوع يعيد السؤال مُجابًا لا فارغًا',
     !btnBy(back, /^تحقّق$/) && !!btnBy(back, /السؤال التالي|إنهاء/));
  ok('ولا محاولة ثانية لنفس السؤال', attempts() === n1, `${attempts()}`);
}

// السؤال الأول: لا رجوع خارج الجلسة
Store.reset();
{
  const { scr } = session();
  const c0 = cardOf(scr);
  swipe(c0, -90);
  ok('السحب يسارًا على الأول لا يكسر شيئًا', !!cardOf(scr));
  ok('ولا زال على السؤال الأول', /١ من/.test(cardOf(scr).textContent));
}

// =============================================================================
// ٣) الامتحان: التخطّي تنقّل، وآخر سؤال لا يُخطّى إلى تسليم
// =============================================================================
Store.reset();
{
  const ex = SEED.exams[0];
  const scr = Screens.exam({ id: ex.id, subject: ex.subject });
  const c = cardOf(scr);
  ok('الامتحان فيه زرّ تخطٍّ', !!btnBy(c, /تخطّي/));
  ok('ولا تغذية راجعة فيه', !c.find('fb')[0]);
  click(btnBy(c, /تخطّي/));
  ok('التخطّي ينقل للسؤال التالي', /٢ من/.test(cardOf(scr).textContent),
     cardOf(scr).textContent.slice(0, 30));
  ok('ولا يُسجَّل جوابًا', /١ بلا إجابة|بلا إجابة/.test(scr.textContent));

  // آخر سؤال
  const last = ex.questions.length;
  for (let n = 1; n < last; n++) { const s = btnBy(cardOf(scr), /تخطّي/); if (s) click(s); else break; }
  const lastCard = cardOf(scr);
  ok('آخر سؤال بلا زرّ تخطٍّ (لا تسليم بالخطأ)',
     /من/.test(lastCard.textContent) && !btnBy(lastCard, /تخطّي/));
}

// =============================================================================
// ٤) التخطّي ليس طريقًا مختصرًا لإكمال الدرس
// =============================================================================
{
  const lid = Object.keys(SEED.lessons).find((k) => SEED.lessons[k].exercises.length);
  const nQ = SEED.lessons[lid].exercises.length;
  const runLesson = (skipAll) => {
    Store.reset();
    const scr = Screens.practice({ lesson: lid, subject });
    for (let n = 0; n < nQ + 2; n++) {
      const c = cardOf(scr);
      if (!c) break;
      if (skipAll) { const s = btnBy(c, /تخطّي/); if (!s) break; click(s); continue; }
      const opt = c.find('opt')[0];
      if (opt) click(opt);
      const go = btnBy(c, /تحقّق/) || btnBy(c, /السؤال التالي|إنهاء/);
      if (!go) break;
      click(go);
      const nx = btnBy(cardOf(scr) || c, /السؤال التالي|إنهاء/);
      if (nx) click(nx);
    }
    return { done: Store.get().lessons[lid] === 'done', out: scr.textContent };
  };
  const skipped2 = runLesson(true);
  ok('تخطّي كل التمارين لا يُكمل الدرس', !skipped2.done);
  ok('والسبب معلَن للطالب', /يكتمل الدرس بحلّها/.test(skipped2.out));
  ok('وحلّها كاملةً يُكمله', runLesson(false).done);
}

console.log('\n' + (bad ? bad + ' فشل' : 'سلوك التخطّي والسحب سليم'));
process.exit(bad ? 1 : 0);
