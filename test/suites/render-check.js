// يتحقّق أن الشاشات الجديدة تُبنى فعلًا بلا استثناء، ويطبع HTML الناتج.
// ليس بديلًا عن الفحص البصري — يكشف أخطاء التشغيل فقط.
const fs = require('fs');
const path = require('node:path');
const dir = path.join(require('node:path').join(__dirname,'..','..'), 'js') + '/';

// --- DOM شحيح ---------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const VOID = new Set(['img', 'input', 'br', 'hr']);

class Node2 {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.attrs = {}; this.className = '';
    this._text = null; this._html = null; this.style = { setProperty() {} };
  }
  get classList() {
    const self = this;
    return { add(c) { self.className += (self.className ? ' ' : '') + c; },
             toggle() {}, remove() {}, contains() { return false; } };
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => c && this.children.push(c)); }
  prepend(...cs) { this.children.unshift(...cs.filter(Boolean)); }
  replaceChildren(...cs) { this.children = cs.filter(Boolean); }
  set textContent(v) { this._text = v; this.children = []; }
  get textContent() {
    if (this._text !== null) return this._text;
    return this.children.map((c) => (c.nodeType === 3 ? c.data : c.textContent)).join('');
  }
  set innerHTML(v) { this._html = v; }
  get outerHTML() {
    const cls = this.className ? ` class="${this.className}"` : '';
    const at = Object.entries(this.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
    if (VOID.has(this.tagName)) return `<${this.tagName}${cls}${at}>`;
    let inner = this._html !== null ? this._html
      : this._text !== null ? esc(this._text)
      : this.children.map((c) => (c.nodeType === 3 ? esc(c.data) : c.outerHTML)).join('');
    return `<${this.tagName}${cls}${at}>${inner}</${this.tagName}>`;
  }
}

global.window = global;
global.document = {
  createElement: (t) => new Node2(t),
  createTextNode: (t) => ({ nodeType: 3, data: String(t) }),
  createElementNS: (ns, t) => new Node2(t),
  documentElement: { setAttribute() {} },
  getElementById: () => new Node2('div'),
  addEventListener() {},
};
global.Node = Node2;
global.localStorage = {
  _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; },
};
global.navigator = { onLine: true };
global.matchMedia = () => ({ addEventListener() {} });
global.addEventListener = () => {};
global.history = { pushState() {} };
global.confirm = () => false;
global.setInterval = () => 0;
global.App = { go() {}, back() {}, drawRail() {}, render() {} };
global.Api = {
  isSignedIn: () => true, signOut() {},
  // نفس منطق api.js الحقيقي: مسار ⇒ رابط، وفارغ ⇒ null
  publicUrl: (p) => (p ? `https://example.supabase.co/storage/v1/object/public/public-media/${p}` : null),
};
global.Sync = { applyStored() {}, syncNow: () => Promise.resolve(), clearContent() {}, pushProgress() {} };
global.Device = { label: () => 'جهاز' };

eval(fs.readFileSync(dir + 'ui.js', 'utf8'));
eval(fs.readFileSync(path.join(require('node:path').join(__dirname,'..','..'), 'test/fixtures.js'), 'utf8'));
eval(fs.readFileSync(dir + 'store.js', 'utf8'));
eval(fs.readFileSync(dir + 'components.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/main.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/course.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/progress.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/onboarding.js', 'utf8'));


// صورة أستاذ حقيقية بالبطاقة لنرى القصّ من عدمه بالمعاينة  // صورة-أستاذ-حقيقية
window.SEED.teachers[0].photo = 'teachers/demo.jpg';
window.SEED.teachers[0].name = 'نوار بشناق';
window.SEED.banners = [
  { id:'b1', title:'اشتراك سنوي — كل المنهاج', sub:'دروس وتمارين وامتحانات وزارية', image:null, target:null },
  { id:'b2', title:'امتحانات وزارية محلولة', sub:'دورات سابقة بصيغة ورقة الفحص', image:null, target:null },
];
Store.set({ signedIn: true, activated: true, username: 'أحمد', grade: 'g9', daysLeft: 283 });

const cases = [
  ['home', () => Screens.home()],
  ['subjects', () => Screens.subjects()],
  ['teacher (بنبذة)', () => Screens.teacher({ id: 'ustaz-sami' })],
  ['teacher (بلا نبذة ولا مواد)', () => Screens.teacher({ id: 'ustaz-rana' })],
  ['teacher (غير موجود)', () => Screens.teacher({ id: 'لا-أحد' })],
  ['course', () => Screens.course({ subject: 'fr' })],
  ['course (بتقدّم)', () => { Store.completeLesson('salutations'); Store.startLesson('articles-definis'); return Screens.course({ subject: 'fr' }); }],
  ['progress', () => Screens.progress()],
  /* درس فيه جدول: الجدول كان يفرض عرضه على عمود الشبكة فتخرج الصفحة كلّها
     عن الشاشة — ظهر الفيديو مقتطعًا والعنوان مبتورًا. */
  ['درس بجدول', () => Screens.lesson({ id: 'salutations', subject: 'fr' })],
  ['account', () => Screens.account()],
  ['auth', () => Screens.auth()],
  ['teacher (بصورة)', () => { window.SEED.teachers[0].photo='teachers/x.png'; const n=Screens.teacher({id:'ustaz-sami'}); window.SEED.teachers[0].photo=null; return n; }],

  /* بطاقة سؤال بنصوص **حقيقية** خلطت اللغتين وكسرت العرض سابقًا. لم تكن
     المعاينة تعرض أي شاشة أسئلة إطلاقًا، ولهذا لم تُرَ هذه الأعطال فيها قطّ. */
  ['سؤال مختلط اللغتين', () => C.questionCard({
    id: 'demo-1', type: 'mcq', subject: 'fr',
    stem: 'ما معنى الكلمة الفرنسية التالية؟\n« inoubliable » (صفة)',
    why: '**inoubliable** = لا يُنسى — من مفردات الصالون الثقافي، الوحدة 3.',
    options: [{ k: 'أ', t: 'مشترك متبادل' }, { k: 'ب', t: 'لا يمكن تجنّبه' },
              { k: 'ج', t: 'لا يُنسى', correct: true }],
  }, { index: 4, total: 31, onNext() {}, onSkip() {} })],

  ['سؤال قواعد فرنسي', () => C.questionCard({
    id: 'demo-2', type: 'mcq', subject: 'fr',
    stem: 'الدورة الأولى ٢٠٢٢ (علمي) — Grammaire :\n'
        + '9- La municipalité a publié un calendrier ......... annoncer les événements sociaux.',
    why: 'الصواب **pour** — أداة الغرض قبل الفعل في صيغة المصدر.',
    options: [{ k: 'أ', t: 'pour', correct: true }, { k: 'ب', t: "de manière à ce qu'" },
              { k: 'ج', t: 'Pour que' }],
  }, { index: 0, total: 18, onNext() {}, onSkip() {} })],
];

let bad = 0;
const out = {};
for (const [name, fn] of cases) {
  try { const n = fn(); out[name] = n.outerHTML; console.log('ok   ' + name); }
  catch (e) { bad++; console.log('FAIL ' + name + ' → ' + e.message); }
}

// حالة حرجة: SEED فارغة تمامًا (قبل أول مزامنة / أول فتح بلا إنترنت)
const full = window.SEED;
window.SEED = { subjects: [], grades: [], units: [], lessons: {}, questions: {}, exams: [], teachers: [] };
for (const [name, fn] of [['home', Screens.home], ['subjects', Screens.subjects]]) {
  try { fn(); console.log('ok   ' + name + ' — SEED فارغة'); }
  catch (e) { bad++; console.log('FAIL ' + name + ' — SEED فارغة → ' + e.message); }
}
window.SEED = full;

fs.writeFileSync(path.join(__dirname, 'render-out.json'), JSON.stringify(out, null, 1));
console.log(bad ? `\n${bad} فشل` : '\nكل الشاشات تُبنى بلا خطأ');
process.exit(bad ? 1 : 0);
