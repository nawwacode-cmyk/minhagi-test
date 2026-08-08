// كتلة محتوى محفوظة ناقصة كانت تستبدل SEED السليم فتكسر الشاشة قبل أي مزامنة.
// وبعد انتقال التخزين إلى IndexedDB يُضاف سؤال ثانٍ: هل يصل محتوى الطالب
// القائم — المحفوظ في localStorage — إلى المخزن الجديد بلا فقد؟
const fs = require('fs');
const ROOT = require('node:path').join(__dirname, '..', '..');
const dir = ROOT + '/js/';

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

global.window = global;
global.location = { search: '' };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
global.addEventListener = () => {};
global.document = { documentElement: { setAttribute() {} }, createElement: () => ({ style: {} }) };
global.Api = { isSignedIn: () => true, from: async () => [], rpc: async () => null };
global.Store = { get: () => ({}), set() {}, pending: () => 0 };
global.Device = { id: () => 'd', label: () => 'ج' };
// بلا indexedDB ⇒ blobstore يسقط إلى localStorage، وهو مسارٌ يجب أن يعمل أيضًا

eval(fs.readFileSync(dir + 'data/seed.js', 'utf8'));
const SCAFFOLD = JSON.parse(JSON.stringify(window.SEED));
const arrays = Object.keys(SCAFFOLD).filter((k) => Array.isArray(SCAFFOLD[k]));
ok('seed.js يعلن مصفوفات الشكل', arrays.length >= 4, arrays.join('، '));

eval(fs.readFileSync(dir + 'data/blobstore.js', 'utf8'));
eval(fs.readFileSync(dir + 'data/sync.js', 'utf8'));

const OLD_KEY = 'manhaji.content.v1';
const OLD_MAP = 'manhaji.idmap.v1';
const full = { ...SCAFFOLD, lessons: { l1: { id: 'l1' } } };

/** يضع الكتلة في المفتاح القديم ثم يشغّل المسار الحقيقي: ترحيل ثم تطبيق */
async function tryBlob(blob) {
  window.SEED = JSON.parse(JSON.stringify(SCAFFOLD));
  await Sync.clearContent();
  localStorage.setItem(OLD_KEY, JSON.stringify(blob));
  const applied = await Sync.applyStored();
  return { applied, seed: window.SEED };
}

(async () => {
  {
    const r = await tryBlob({ ...full, marker: 'جديد' });
    ok('الكتلة الكاملة تُطبَّق', r.applied === true && r.seed.marker === 'جديد');
  }

  // كل مصفوفة ناقصة على حدة ⇒ تُكمَّل، والمحتوى المخزَّن لا يضيع
  let healed = 0;
  for (const k of arrays) {
    const blob = { ...full, marker: 'محتوى الطالب' }; delete blob[k];
    const r = await tryBlob(blob);
    if (r.applied === true && Array.isArray(r.seed[k]) && r.seed.marker === 'محتوى الطالب') healed++;
    else ok(`نقص «${k}» يُكمَّل`, false, `applied=${r.applied} · ${typeof r.seed[k]}`);
  }
  ok('كل مصفوفة ناقصة تُكمَّل بلا فقد المحتوى', healed === arrays.length, `${healed}/${arrays.length}`);

  {
    const r = await tryBlob({ ...full, subjects: null });
    ok('حقل null يُصحَّح إلى مصفوفة', r.applied === true && Array.isArray(r.seed.subjects));
    const r2 = await tryBlob({ ...full, units: { a: 1 } });
    ok('حقل بشكل خاطئ يُصحَّح', r2.applied === true && Array.isArray(r2.seed.units));
  }

  {
    const r = await tryBlob({ ...SCAFFOLD, lessons: {} });
    ok('كتلة بلا دروس ما زالت تُرفض', r.applied === false);
  }

  {
    window.SEED = JSON.parse(JSON.stringify(SCAFFOLD));
    await Sync.clearContent();
    localStorage.setItem(OLD_KEY, '{ نص تالف');
    let threw = false;
    try { await Sync.applyStored(); } catch { threw = true; }
    ok('JSON تالف لا يرمي', !threw);
  }

  // --- الترحيل: محتوى الطالب القائم ينتقل ولا يُنسخ -----------------------------
  {
    await Sync.clearContent();
    localStorage.setItem(OLD_KEY, JSON.stringify({ ...full, marker: 'محتوى قديم' }));
    localStorage.setItem(OLD_MAP, JSON.stringify({ 'lesson:l1': 'uuid-1' }));

    const applied = await Sync.applyStored();
    ok('محتوى الطالب القائم يصل إلى المخزن الجديد',
       applied === true && (await Blob2.get('content'))?.marker === 'محتوى قديم');
    ok('وخريطة المعرّفات معه', Sync.idOf('lesson', 'l1') === 'uuid-1',
       'بدونها يُرفع تقدّمه إلى معرّفات فارغة');
    // النقل لا النسخ: القديم يحجز من حصّة ٥ م.ب، وقد يُقرأ لاحقًا فيطمس الجديد
    ok('ولم تبقَ نسخة في المفاتيح القديمة',
       localStorage.getItem(OLD_KEY) === null && localStorage.getItem(OLD_MAP) === null);
  }

  // --- الخروج يمسح كل شيء، وإلّا رأى الطالب التالي محتوى سابقه -----------------
  {
    localStorage.setItem('manhaji.content.ver', 'v-قديمة');
    await Sync.clearContent();
    ok('الخروج يمسح المحتوى من المخزن الجديد', (await Blob2.get('content')) === null);
    ok('ويمسح البصمة أيضًا', localStorage.getItem('manhaji.content.ver') === null,
       'بصمة باقية تجعل الطالب التالي يتخطّى السحب فلا يرى شيئًا');
    ok('وخريطة المعرّفات في الذاكرة تُفرَّغ', Sync.idOf('lesson', 'l1') === null,
       'وإلّا رُفع تقدّم الطالب الجديد إلى صفوف الطالب السابق');
  }

  console.log('\n' + (bad ? bad + ' فشل' : 'عقد الشكل والترحيل سليمان'));
  process.exit(bad ? 1 : 0);
})();
