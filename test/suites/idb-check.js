// المسارات السابقة اختبرت blobstore على بديل localStorage. هذا يشغّله على
// IndexedDB حقيقي (fake-indexeddb يطبّق المواصفة نفسها)، لأن الفروق التي تهمّ
// — المعاملات، الاستنساخ البنيوي، غياب JSON — لا تظهر في البديل إطلاقًا.
/* يحتاج تطبيقًا حقيقيًا لـIndexedDB:  npm i -D fake-indexeddb
   ولا نجعل غيابه فشلًا: بقيّة المجموعات تغطّي مسار البديل (localStorage)،
   وفشلٌ لأن حزمة ناقصة يُعلّم المطوّر أن يتجاهل الأحمر — وهو أسوأ ما يصيب
   مجموعة اختبارات. نتخطّى بوضوح بدل أن نكذب أو نُفزع. */
try { require('fake-indexeddb/auto'); }
catch {
  console.log('⏭  تُخطّيت: نصّب fake-indexeddb لتشغيلها  →  npm i -D fake-indexeddb');
  process.exit(0);
}
const fs = require('fs');
const dir = require('node:path').join(__dirname, '..', '..', 'js') + '/';

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

global.window = global;
global.location = { search: '' };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
global.addEventListener = () => {};
global.document = { documentElement: { setAttribute() {} } };
global.Api = { isSignedIn: () => true, from: async () => [], rpc: async () => null };
global.Store = { _s: {}, get() { return this._s; }, set(p) { Object.assign(this._s, p); }, pending: () => 0 };
global.Device = { id: () => 'd', label: () => 'ج' };

eval(fs.readFileSync(dir + 'data/seed.js', 'utf8'));
eval(fs.readFileSync(dir + 'data/blobstore.js', 'utf8'));
eval(fs.readFileSync(dir + 'data/sync.js', 'utf8'));

(async () => {
  ok('IndexedDB مُكتشَف ومستعمل', await Blob2.available() === true);

  // --- الاستنساخ البنيوي: كائن يعود كائنًا لا نصًّا -----------------------------
  const obj = { عربي: 'نصّ عربي طويل', n: 42, arr: [1, 2, 3], nested: { a: { b: 'ج' } } };
  await Blob2.set('t', obj);
  const back = await Blob2.get('t');
  ok('الكائن يعود كائنًا لا نصًّا', typeof back === 'object' && back !== null);
  ok('بكل بنيته وقيمه', JSON.stringify(back) === JSON.stringify(obj));
  {
    /* التعليقات تُجرَّد قبل الفحص: نصّ الشرح نفسه يذكر JSON.stringify، فبلا
       تجريدها يفشل الاختبار على تعليقه لا على شيفرته. */
    const src = fs.readFileSync(dir + 'data/blobstore.js', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const idbPath = src.split('const lsKey')[0];   // ما قبل بديل localStorage
    ok('مسار IndexedDB لا يمرّ بـJSON (لا مضاعفة UTF-16 ولا تحليل عند الإقلاع)',
       !/JSON\.(stringify|parse)/.test(idbPath));
  }

  // --- الحجم: ما كان يستحيل على localStorage --------------------------------------
  // بكالوريا + تاسع ≈ ٢٠ مادة. نبني كتلة بحجمها ونتأكّد أنها تُحفظ وتُقرأ.
  const big = { lessons: {}, questions: {} };
  const para = 'نصّ عربي يمثّل شرح درس أو متن سؤال. '.repeat(30);
  for (let i = 0; i < 8000; i++) big.questions['q' + i] = { id: 'q' + i, stem: para, why: para };
  for (let i = 0; i < 800; i++) big.lessons['l' + i] = { id: 'l' + i, body: para };
  const chars = JSON.stringify(big).length;
  const t0 = Date.now();
  await Blob2.set('big', big);
  const wrote = Date.now() - t0;
  const read = await Blob2.get('big');
  ok('كتلة بحجم بكالوريا + تاسع تُحفظ وتُقرأ',
     Object.keys(read.questions).length === 8000 && Object.keys(read.lessons).length === 800,
     `${(chars / 1024 / 1024).toFixed(1)} م.ب نصًّا · ~${(chars * 2 / 1024 / 1024).toFixed(1)} م.ب لو UTF-16 · الكتابة ${wrote}ms`);
  ok('وهي فوق حصّة localStorage أصلًا (٥ م.ب)', chars * 2 > 5 * 1024 * 1024,
     'لو بقي التخزين هناك لفشل هذا الحفظ');

  // --- الترحيل على IndexedDB حقيقي ------------------------------------------------
  await Sync.clearContent();
  localStorage.setItem('manhaji.content.v1', JSON.stringify(
    { ...window.SEED, lessons: { l1: { id: 'l1' } }, marker: 'قديم' }));
  localStorage.setItem('manhaji.idmap.v1', JSON.stringify({ 'lesson:l1': 'uuid-1' }));
  const applied = await Sync.applyStored();
  ok('الترحيل يعمل على IndexedDB حقيقي', applied === true && window.SEED.marker === 'قديم');
  ok('والخريطة انتقلت', Sync.idOf('lesson', 'l1') === 'uuid-1');
  ok('والمفاتيح القديمة أُفرِغت', localStorage.getItem('manhaji.content.v1') === null);

  // --- الترحيل مرّة واحدة لا مرّة كل مزامنة ----------------------------------------
  localStorage.setItem('manhaji.content.v1', JSON.stringify({ ...window.SEED, marker: 'دخيل' }));
  await Sync.applyStored();
  ok('لا يُعاد الترحيل بعد أوّل مرّة', window.SEED.marker !== 'دخيل',
     'وإلّا أعادت كتلةٌ قديمة نفسها فوق محتوى أحدث عند كل مزامنة');

  // --- clearContent يمسح فعلًا -----------------------------------------------------
  await Sync.clearContent();
  ok('الخروج يمسح من IndexedDB', (await Blob2.get('content')) === null);

  console.log('\n' + (bad ? bad + ' فشل' : 'التخزين على IndexedDB سليم'));
  process.exit(bad ? 1 : 0);
})();
