// يتحقّق أن الشاشات الجديدة تُبنى فعلًا بلا استثناء، ويطبع HTML الناتج.
// ليس بديلًا عن الفحص البصري — يكشف أخطاء التشغيل فقط.
const fs = require('fs');
const path = require('node:path');
const dir = path.join(__dirname, '..', '..', 'js') + '/';

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
global.Device = { label: () => 'جهاز', fingerprint: () => Promise.resolve('fp-فحص') };
/* عارض الـPDF يبني عقدته تزامنيًّا ثم يملؤها من الشبكة. الفحص يهمّه البناء،
   فنعطيه ما يكفي كي لا يرمي: مراقبَ تقاطعٍ صامتًا ونداءَ شبكةٍ يفشل بهدوء. */
global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!global.Api.invoke) global.Api.invoke = () => Promise.reject(new Error('لا شبكة في الفحص'));

eval(fs.readFileSync(dir + 'ui.js', 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '..', 'fixtures.js'), 'utf8'));
eval(fs.readFileSync(dir + 'store.js', 'utf8'));
eval(fs.readFileSync(dir + 'data/doc.js', 'utf8'));
eval(fs.readFileSync(dir + 'components.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/main.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/course.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/progress.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/onboarding.js', 'utf8'));
/* هذه الثلاثة كانت ناقصة، فلم يرسمها أي فحص قط. وأسوأ من نقص التغطية أنها
   كانت تُفسد فحوصًا أخرى بصمت: `boot` تستأنف الشاشة المحفوظة بشرط
   `Screens[r.name]`، فغياب `exam.js` جعل استئناف «النتيجة» يسقط إلى
   الرئيسية داخل الفحص وحده — سلوكٌ لا وجود له في التطبيق، إذ يحمّلها
   `index.html` و`sw.js` كلاهما. القائمة هنا يجب أن تطابقهما. */
eval(fs.readFileSync(dir + 'screens/exam.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/evicted.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/halted.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/plan.js', 'utf8'));
eval(fs.readFileSync(dir + 'screens/account.js', 'utf8'));

Store.set({ signedIn: true, activated: true, username: 'أحمد', grade: 'g9', daysLeft: 283 });

