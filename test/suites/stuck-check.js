// «يضلّ جارٍ التحميل»: مع وجود سقف ٦ ثوانٍ لا يبقى السبلاش إلا إذا عُطِّل
// السقف نفسه. نختبر المسارات الثلاثة التي تُعطّله.
const fs = require('fs');
const dir = require('node:path').join(__dirname, '..', '..', 'js') + '/';

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

class N {
  constructor(t) { this.tagName = t; this.children = []; this.attrs = {}; this.className = ''; this.style = {}; }
  get classList() { const s = this; return { add(c) { s.className += ' ' + c; }, remove() {}, toggle() {}, contains: (c) => s.className.includes(c) }; }
  setAttribute(k, v) { this.attrs[k] = v; } getAttribute(k) { return this.attrs[k]; }
  addEventListener() {}
  appendChild(c) { this.children.push(c); c._p = this; return c; }
  append(...c) { c.forEach((x) => x && this.appendChild(x)); }
  replaceChildren(...c) { this.children = c.filter(Boolean); }
  remove() { if (this._p) this._p.children = this._p.children.filter((x) => x !== this); }
  set textContent(v) { this._t = v; } get textContent() { return this._t || ''; }
  set innerHTML(v) { this._h = v; }
  querySelector() { return null; }
}
const body = new N('body');
globalThis.window = globalThis;
globalThis.document = {
  createElement: (t) => new N(t), createElementNS: (n, t) => new N(t),
  createTextNode: (t) => ({ nodeType: 3, data: String(t) }),
  documentElement: { setAttribute() {} }, getElementById: () => new N('div'),
  body, addEventListener() {}, visibilityState: 'visible',
};
globalThis.Node = N;
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
globalThis.location = { search: '', protocol: 'file:' };
globalThis.navigator = globalThis.navigator || {};
globalThis.matchMedia = () => ({ addEventListener() {}, matches: false });
globalThis.addEventListener = () => {};
globalThis.history = { pushState() {} };
const timers = [];
globalThis.setInterval = () => 0;
globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };

eval(fs.readFileSync(dir + 'ui.js', 'utf8'));
eval(fs.readFileSync(require('node:path').join(__dirname, '..', 'fixtures.js'), 'utf8'));
eval(fs.readFileSync(dir + 'store.js', 'utf8'));

const splashUp = () => body.children.some((c) => /splash/.test(c.className) && !/splash--out/.test(c.className));

function boot({ homeThrowsAfter = 0 } = {}) {
  body.children.length = 0; timers.length = 0;
  let calls = 0;
  globalThis.Api = { isSignedIn: () => true, userId: () => 'u' };
  let resolve;
  const p = new Promise((r) => { resolve = r; });
  globalThis.Sync = { applyStored() {}, pushProgress() {}, syncNow: () => p };
  globalThis.Screens = {
    home: () => {
      calls++;
      if (homeThrowsAfter && calls > homeThrowsAfter) throw new TypeError('بيانات الخادم كسرت الشاشة');
      return new N('div');
    },
    auth: () => new N('div'),
  };
  Store.set({ signedIn: true, route: null, theme: 'light' });
  delete globalThis.App;
  eval(fs.readFileSync(dir + 'app.js', 'utf8').replace(/document\.addEventListener\([\s\S]*$/, ''));
  let bootThrew = null;
  try { App.boot(); } catch (e) { bootThrew = e; }
  return { resolve, bootThrew, guard: () => timers.filter((t) => t.ms === 6000).forEach((t) => t.fn()) };
}

(async () => {
  // ١) المسار السليم
  let r = boot();
  ok('السبلاش يظهر', splashUp());
  r.resolve({ changed: true });
  await new Promise((z) => process.nextTick(z)); await new Promise((z) => process.nextTick(z));
  ok('ويختفي بعد المزامنة', !splashUp());

  // ٢) الشاشة تُبنى قبل المزامنة وتنكسر بعدها ببيانات الخادم — الحالة الواقعية
  r = boot({ homeThrowsAfter: 1 });
  ok('الإقلاع لا ينهار', !r.bootThrew, r.bootThrew ? r.bootThrew.message : '');
  ok('السبلاش ظاهر قبل المزامنة', splashUp());
  r.resolve({ changed: true });
  await new Promise((z) => process.nextTick(z)); await new Promise((z) => process.nextTick(z));
  ok('انكسار الرسم بعد المزامنة لا يُبقي السبلاش', !splashUp(),
     splashUp() ? 'عالق' : 'انكشف');

  // ٣) وحتى لو بقي، السقف الزمني يجب أن يرفعه — لا أن يكون قد "استُهلك"
  if (splashUp()) { r.guard(); ok('السقف الزمني ينقذ الموقف', !splashUp()); }

  // ٤) الشاشة مكسورة من أول لحظة (بيانات مخزَّنة تالفة)
  r = boot({ homeThrowsAfter: 0.5 });   // تنكسر من النداء الأول
  ok('انكسار الرسم الأول لا يمنع تسجيل السقف', timers.some((t) => t.ms === 6000));
  r.guard();
  ok('والسقف يرفع السبلاش', !splashUp());

  console.log('\n' + (bad ? bad + ' فشل' : 'لا مسار يُبقي السبلاش عالقًا'));
  process.exit(bad ? 1 : 0);
})();
