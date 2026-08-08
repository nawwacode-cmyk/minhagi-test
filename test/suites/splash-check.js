// يشغّل App.boot الحقيقي بحالات مختلفة ويتأكّد من سلوك السبلاش:
// يظهر للمسجَّل، يختفي بعد المزامنة، لا يظهر بشاشة الدخول، ولا يعلق بلا إنترنت.
const fs = require('fs');
const dir = require('node:path').join(__dirname, '..', '..', 'js') + '/';

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

// --- DOM شحيح مع تتبّع body ---------------------------------------------------
class N {
  constructor(t) {
    this.tagName = t; this.children = []; this.attrs = {}; this.className = '';
    this._h = null; this.style = {};
  }
  get classList() {
    const s = this;
    return { add(c) { s.className += ' ' + c; }, remove() {}, toggle() {},
             contains: (c) => s.className.includes(c) };
  }
  setAttribute(k, v) { this.attrs[k] = v; } getAttribute(k) { return this.attrs[k]; }
  addEventListener() {}
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  append(...c) { c.forEach((x) => x && this.appendChild(x)); }
  replaceChildren(...c) { this.children = c.filter(Boolean); }
  remove() { if (this._parent) this._parent.children = this._parent.children.filter((x) => x !== this); }
  set textContent(v) { this._t = v; } get textContent() { return this._t || ''; }
  set innerHTML(v) { this._h = v; }
  querySelector() { return null; }
}
const body = new N('body');
globalThis.window = globalThis;
globalThis.document = {
  createElement: (t) => new N(t),
  createElementNS: (ns, t) => new N(t),
  createTextNode: (t) => ({ nodeType: 3, data: String(t) }),
  documentElement: { setAttribute() {} },
  getElementById: () => new N('div'),
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
globalThis.Screens = { home: () => new N('div'), auth: () => new N('div') };

const splashCount = () => body.children.filter((c) => /splash/.test(c.className)).length;
const splashOut = () => body.children.some((c) => /splash--out/.test(c.className));

function run(label, { signedIn, syncPromise }) {
  body.children.length = 0; timers.length = 0;
  globalThis.Api = { isSignedIn: () => signedIn, userId: () => 'u' };
  globalThis.Sync = {
    applyStored() {}, pushProgress() {},
    syncNow: () => syncPromise,
  };
  Store.set({ signedIn, route: null, theme: 'light' });
  delete globalThis.App;
  eval(fs.readFileSync(dir + 'app.js', 'utf8').replace(/document\.addEventListener\([\s\S]*$/, ''));
  App.boot();
  return label;
}

(async () => {
  // ١) مسجَّل ومزامنة تنجح ⇒ سبلاش يظهر ثم يختفي
  let resolveSync;
  run('a', { signedIn: true, syncPromise: new Promise((r) => { resolveSync = r; }) });
  ok('السبلاش يظهر للمسجَّل', splashCount() === 1);
  // نجمع النصوص يدويًا — JSON.stringify يفشل على شجرة فيها _parent دائري
  // العقد النصّية من createTextNode ليست N بل {nodeType:3,data}
  const textOf = (n) => (n.nodeType === 3 ? n.data : '')
    + (n._t || '') + (n.children || []).map(textOf).join('');
  ok('نصّه «جارٍ التحميل»', textOf(body.children[0]).includes('جارٍ التحميل'));
  ok('يحوي القلم', /pencil/.test(body.children[0].children[0]._h || ''));
  ok('لا يختفي قبل انتهاء المزامنة', !splashOut());

  resolveSync({ changed: true });
  await new Promise((r) => process.nextTick(r));
  await new Promise((r) => process.nextTick(r));
  ok('يختفي بعد انتهاء المزامنة', splashOut());

  // ٢) شاشة الدخول ⇒ بلا سبلاش
  run('b', { signedIn: false, syncPromise: Promise.resolve(null) });
  ok('لا سبلاش على شاشة الدخول', splashCount() === 0);

  // ٣) بلا إنترنت: المزامنة لا تنتهي أبدًا ⇒ السقف الزمني يرفع الغطاء
  run('c', { signedIn: true, syncPromise: new Promise(() => {}) });
  ok('السبلاش يظهر بلا إنترنت', splashCount() === 1);
  ok('لا يختفي تلقائيًا', !splashOut());
  const guard = timers.find((t) => t.ms === 6000);
  ok('يوجد سقف زمني', !!guard, guard ? guard.ms + 'ms' : 'لا يوجد');
  if (guard) {
    guard.fn();
    ok('السقف يرفع الغطاء فلا يعلق الطالب', splashOut());
  }

  // ٤) المزامنة تفشل ⇒ لا يعلق أيضًا
  run('d', { signedIn: true, syncPromise: Promise.reject(new Error('x')) });
  await new Promise((r) => process.nextTick(r));
  await new Promise((r) => process.nextTick(r));
  ok('فشل المزامنة لا يُبقي السبلاش', splashOut());

  console.log('\n' + (bad ? bad + ' فشل' : 'سلوك السبلاش سليم'));
  process.exit(bad ? 1 : 0);
})();
