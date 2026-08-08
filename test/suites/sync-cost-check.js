// يقود Sync.syncNow الحقيقي على «خادم» وهمي يعدّ الطلبات، ويتحقّق من:
//   ١) بلا تغيّر في المحتوى لا يُسحب الكتالوج إطلاقًا
//   ٢) أي تغيّر (أو حذف) يعيد السحب
//   ٣) امتلاء المساحة لا يمرّ صامتًا ولا يترك كتابة نصفية ولا يُثبّت البصمة
//   ٤) الاستحقاق يُسحب حتى حين يُتخطّى المحتوى
const fs = require('fs');
const ROOT = require('node:path').join(__dirname, '..', '..');
const dir = ROOT + '/js/';

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

global.window = global;
global.location = { search: '' };
// navigator في Node 24 عالميّ للقراءة فقط: الإسناد المباشر يمرّ بلا أثر
// فتصير navigator.onLine غير معرّفة ويُتخطّى نصف المزامنة بصمت.
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
global.addEventListener = () => {};
global.document = { documentElement: { setAttribute() {} } };

// --- تخزين بحصّة قابلة للضبط -----------------------------------------------------
let QUOTA = Infinity;
const mkStore = () => ({
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  removeItem(k) { delete this._d[k]; },
  setItem(k, v) {
    const size = Object.entries(this._d)
      .filter(([kk]) => kk !== k).reduce((a, [, vv]) => a + vv.length, 0) + String(v).length;
    if (size > QUOTA) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
    this._d[k] = String(v);
  },
});
global.localStorage = mkStore();

eval(fs.readFileSync(dir + 'data/seed.js', 'utf8'));
eval(fs.readFileSync(dir + 'store.js', 'utf8'));

// --- خادم وهمي يعدّ ---------------------------------------------------------------
let VERSION = '2026-08-07T10:00:00Z';
let calls = { rpc: {}, from: {} };
const rows = {
  subjects: [{ id: 's1', code: 'fr', name_ar: 'الفرنسية', sort_order: 1 }],
  grades: [{ id: 'g1', code: 'g12', name_ar: 'البكالوريا', sort_order: 1 }],
  units: [{ id: 'u1', code: 'u1', title_ar: 'وحدة', course_id: 'c1', sort_order: 1,
            courses: { subject_id: 's1', grade_id: 'g1' } }],
  lessons: [{ id: 'l1', code: 'l1', title_ar: 'درس', body_html: 'ن', est_minutes: 5,
              is_free: true, unit_id: 'u1', video_id: null, sort_order: 1 }],
};
global.Api = {
  isSignedIn: () => true,
  rpc: async (fn) => {
    calls.rpc[fn] = (calls.rpc[fn] || 0) + 1;
    if (fn === 'content_version') return VERSION;
    if (fn === 'session_status') return { current: true };
    if (fn === 'my_entitlements') return [{ days_left: 30 }];
    return [];
  },
  from: async (t) => { calls.from[t] = (calls.from[t] || 0) + 1; return rows[t] || []; },
  upsert: async () => [],
};
global.Device = { id: () => 'd1', label: () => 'ج' };

eval(fs.readFileSync(dir + 'data/blobstore.js', 'utf8'));
eval(fs.readFileSync(dir + 'data/sync.js', 'utf8'));

const pulls = () => calls.from.questions || 0;
const reset = () => { calls = { rpc: {}, from: {} }; };
const run = async () => { reset(); return Sync.syncNow(); };

(async () => {
  Store.set({ signedIn: true, activated: true });

  // ١) أول مزامنة: سحب كامل
  await run();
  ok('أول مزامنة تسحب الكتالوج', pulls() === 1, `${pulls()} سحبة`);
  ok('والبصمة حُفظت', localStorage.getItem('manhaji.content.ver') === VERSION);

  // ٢) مزامنات تالية بلا تغيّر: لا سحب إطلاقًا
  let skipped = 0;
  for (let i = 0; i < 5; i++) { await run(); if (pulls() === 0) skipped++; }
  ok('خمس فتحات بلا تغيّر ⇒ صفر سحبات', skipped === 5, `${skipped}/5`);
  await run();
  ok('لكنّها ما زالت تسأل عن البصمة', calls.rpc.content_version === 1);
  ok('والاستحقاق يُسحب رغم تخطّي المحتوى', calls.rpc.my_entitlements === 1,
     'أيام الاشتراك تنقص بمرور الوقت لا بتغيّر المحتوى');

  // ٣) تغيّر البصمة (تعديل أو حذف) ⇒ سحب
  VERSION = '2026-08-09T08:00:00Z';
  await run();
  ok('تغيّر البصمة يعيد السحب', pulls() === 1);
  await run();
  ok('ثم يهدأ ثانيةً', pulls() === 0);

  // ٤) بصمة غير صالحة أو تعذّر الاتصال ⇒ نسحب احتياطًا لا نتخطّى
  for (const [label, v] of [['فارغة', 'empty'], ['null', null], ['رقم', 7]]) {
    VERSION = v; reset(); await Sync.syncNow();
    ok(`بصمة ${label} ⇒ نسحب احتياطًا`, pulls() === 1);
  }
  {
    const orig = Api.rpc;
    Api.rpc = async (fn) => { if (fn === 'content_version') throw new Error('شبكة'); return orig(fn); };
    reset(); await Sync.syncNow();
    ok('تعذّر سؤال البصمة ⇒ نسحب احتياطًا', pulls() === 1);
    Api.rpc = orig;
  }

  // ٥) لا محتوى مخزَّنًا (جهاز جديد) رغم بصمة مطابقة ⇒ نسحب
  VERSION = '2026-08-10T08:00:00Z';
  await run();                  // يخزّن ويثبّت البصمة
  await Blob2.del('content');   // كأن المتصفّح مسح التخزين
  await run();
  ok('بصمة مطابقة بلا محتوى مخزَّن ⇒ نسحب', pulls() === 1);

  // ٦) المساحة ممتلئة: لا كتابة نصفية، ولا بصمة، وعلامة ظاهرة
  VERSION = '2026-08-11T08:00:00Z';
  await run();
  const goodContent = JSON.stringify(await Blob2.get('content'));
  const goodMap = JSON.stringify(await Blob2.get('idmap'));
  const goodVer = localStorage.getItem('manhaji.content.ver');

  VERSION = '2026-08-12T08:00:00Z';
  QUOTA = (goodContent.length + goodMap.length) - 50;   // يكفي للأولى لا للثانية
  reset(); await Sync.syncNow();
  QUOTA = Infinity;

  ok('العلامة تُرفع للطالب', Store.get().storageFull === true);
  ok('المحتوى القديم سليم لم يُمسح',
     JSON.stringify(await Blob2.get('content')) === goodContent);
  ok('وخريطة المعرّفات ما زالت مطابقة له',
     JSON.stringify(await Blob2.get('idmap')) === goodMap,
     'كتابة نصفية هنا ترسل تقدّم الطالب إلى صفوف خاطئة');
  ok('وخريطة الذاكرة رُدّت أيضًا لا القرص وحده',
     JSON.stringify(await Blob2.get('idmap')) === JSON.stringify(
       Object.fromEntries(Object.keys(JSON.parse(goodMap)).map((k) => [k, Sync.idOf(...k.split(':'))]))),
     'خريطة ذاكرة أحدث من القرص ترسل التقدّم إلى صفوف لم تُحفظ');
  ok('والبصمة لم تُثبَّت (وإلّا تجمّد المحتوى للأبد)',
     localStorage.getItem('manhaji.content.ver') === goodVer, localStorage.getItem('manhaji.content.ver'));

  // تعود المساحة ⇒ يُستأنف كل شيء وتنطفئ العلامة
  reset(); await Sync.syncNow();
  ok('عودة المساحة تستأنف السحب', pulls() === 1);
  ok('وتُطفئ العلامة', Store.get().storageFull === false);
  ok('وتُثبّت البصمة الجديدة', localStorage.getItem('manhaji.content.ver') === '2026-08-12T08:00:00Z');

  // ٧) الوفر بالأرقام
  reset();
  for (let i = 0; i < 20; i++) await Sync.syncNow();
  const q = pulls();
  ok('٢٠ فتحة بلا تغيّر ⇒ صفر سحبات كتالوج', q === 0,
     `قبل التعديل: ٢٠ سحبة × ١٢ استعلامًا = ٢٤٠ استعلامًا`);

  console.log('\n' + (bad ? bad + ' فشل' : 'كلفة المزامنة وحماية التخزين سليمتان'));
  process.exit(bad ? 1 : 0);
})();
