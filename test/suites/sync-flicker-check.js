// يشغّل pullProgress الحقيقية بشبكة مزيّفة ويتأكّد أنها تُرجع صفرًا حين لا
// يتغيّر شيء — وهو ما يمنع الرفة الدورية.
const fs = require('fs');
const dir = require('node:path').join(__dirname, '..', '..', 'js') + '/';

global.window = global;
global.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
global.document = { documentElement: { setAttribute() {} }, addEventListener() {} };
global.addEventListener = () => {};
global.location = { search: '' };   // sync.js يقرأ ?demo منها
global.navigator = { onLine: true };

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

eval(fs.readFileSync(dir + 'store.js', 'utf8'));

// خريطة الرموز التي تعتمدها reverseMap
localStorage.setItem('manhaji.idmap.v1', JSON.stringify({
  'lesson:salutations': 'L1', 'exam:mock-1': 'E1',
}));

// شبكة مزيّفة: نفس الصفوف في كل مرة — أي «لا جديد»
const rows = {
  lesson_progress: [{ lesson_id: 'L1', status: 'done', updated_at: '2026-01-01' }],
  exam_attempts: [{ exam_id: 'E1', score_percent: 80, submitted_at: '2026-01-01' }],
};
global.Api = {
  isSignedIn: () => true,
  userId: () => 'u1',
  from: async (t) => rows[t] || [],
  upsert: async () => {},
  rpc: async () => ({ current: true }),
  publicUrl: (p) => (p ? 'x/' + p : null),
};
global.Device = { fingerprint: async () => 'fp' };

eval(fs.readFileSync(dir + 'data/blobstore.js', 'utf8'));
eval(fs.readFileSync(dir + 'data/sync.js', 'utf8'));

(async () => {
  Store.set({ lessons: {}, exams: {} });
  let n = await Sync.pullProgress();
  ok('أول سحب يعدّ التغييرات', n === 2, n + ' (متوقَّع 2)');
  ok('الحالة كُتبت فعلًا', Store.get().lessons.salutations === 'done');

  n = await Sync.pullProgress();
  ok('سحب مطابق يُرجع صفرًا (لا رفة)', n === 0, n + ' (متوقَّع 0)');

  n = await Sync.pullProgress();
  ok('وتكرارًا يبقى صفرًا', n === 0, String(n));

  rows.exam_attempts = [{ exam_id: 'E1', score_percent: 95, submitted_at: '2026-01-02' }];
  n = await Sync.pullProgress();
  ok('تحسّن نتيجة امتحان يُكتشف', n === 1, n + ' (متوقَّع 1)');
  ok('أفضل نتيجة تحدّثت', Store.get().exams['mock-1'].best === 95);

  n = await Sync.pullProgress();
  ok('يستقرّ بعد التغيير', n === 0, String(n));

  rows.lesson_progress = [{ lesson_id: 'L1', status: 'in_progress', updated_at: '2026-01-03' }];
  n = await Sync.pullProgress();
  ok('المكتمل محليًا لا يتراجع', Store.get().lessons.salutations === 'done' && n === 0, String(n));

  console.log('\n' + (bad ? bad + ' فشل' : 'منطق المزامنة سليم — لا رفة بلا تغيير'));
  process.exit(bad ? 1 : 0);
})();
