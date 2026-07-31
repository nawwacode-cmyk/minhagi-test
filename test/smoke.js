// اختبار دخان لمنطق المتجر — بلا متصفح
//   node test/smoke.js
const fs = require('fs');
// نسبةً إلى موقع هذا الملف لا إلى مجلد التشغيل — حتى يعمل من أي مكان
const dir = require('node:path').join(__dirname, '..', 'js') + '/';

global.window = global;
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = v; },
  removeItem(k) { delete this._d[k]; },
};
global.document = { documentElement: { setAttribute() {} } };

eval(fs.readFileSync(dir + 'data/seed.js', 'utf8'));
eval(fs.readFileSync(dir + 'store.js', 'utf8'));

const fail = [];
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fail.push(name); };

// --- الحالة الابتدائية ---
let p = Store.subjectProgress();
ok('يبدأ التقدّم من صفر', p.percent === 0);
ok('عدد الدروس = 4', p.lessonsTotal === 4);

// --- معادلة الإتقان: يجب أن تطابق tg_apply_topic_mastery في SQL ---
Store.recordAttempt('articles', true);
ok('أول إجابة صحيحة ← 65', Store.get().mastery.articles.mastery === 65);
Store.recordAttempt('articles', false);
ok('ثم خطأ ← 46', Store.get().mastery.articles.mastery === Math.round(0.7 * 65));
Store.recordAttempt('syntaxe', false);
ok('أول خطأ في موضوع جديد ← 35', Store.get().mastery.syntaxe.mastery === 35);

// --- التقدّم الموزون: 0.50 دروس + 0.35 إتقان + 0.15 امتحان ---
Store.completeLesson('salutations');
Store.completeLesson('articles-definis');
Store.recordExam('mock-1', 80);
p = Store.subjectProgress();
const expected = Math.round(0.50 * 50 + 0.35 * ((46 + 35) / 2) + 0.15 * 80);
ok(`المؤشر الموزون = ${expected}`, p.percent === expected);
ok('لا يتجاوز 100', p.percent <= 100 && p.percent >= 0);

// --- تكرار إكمال نفس الدرس لا يُحتسب مرتين ---
const before = Store.subjectProgress().lessonsDone;
Store.completeLesson('salutations');
ok('إكمال درس مكتمل لا يغيّر شيئًا', Store.subjectProgress().lessonsDone === before);

// --- أضعف موضوع ---
ok('أضعف موضوع = syntaxe', Store.weakestTopic().id === 'syntaxe');

// --- تقدّم الوحدة ---
ok('الوحدة الأولى مكتملة ٢/٢', Store.unitProgress(SEED.units[0]).done === 2);

// --- التنزيلات ---
ok('articles-definis منزَّل ابتداءً', Store.get().downloaded.includes('articles-definis'));
Store.toggleDownload('articles-definis');
ok('يمكن حذف التنزيل', !Store.get().downloaded.includes('articles-definis'));

// --- الحفظ المحلي ---
ok('يُحفظ في localStorage', !!localStorage.getItem('manhaji.v1'));

// --- تسجيل الدخول: اسم مستخدم + كود، بجهاز واحد ------------------------------
Store.reset();
ok('يرفض اسم المستخدم القصير', !!Store.signIn('اح', 'FR97K3M'));
ok('يرفض الكود الناقص',        !!Store.signIn('أحمد', 'FR9'));
ok('يرفض بادئة غير معروفة',    !!Store.signIn('أحمد', 'ZZ12345'));
ok('يرفض كودًا مرتبطًا بجهاز آخر', !!Store.signIn('أحمد', 'FR9USED'));
ok('لا يُسجَّل الدخول بعد الرفض', Store.get().signedIn === false);

ok('يقبل كود التاسع', Store.signIn('أحمد', 'fr9-7k3m') === null);   // حروف صغيرة وشرطة
ok('الصف مشتقّ من الكود', Store.get().grade === 'g9');
ok('اسم المستخدم محفوظ', Store.get().username === 'أحمد');
ok('جهاز واحد مرتبط', Store.get().devices.length === Store.MAX_DEVICES);

Store.signOut();
ok('الخروج يفكّ ربط الجهاز', Store.get().devices.length === 0 && !Store.get().signedIn);

ok('يقبل كود البكالوريا', Store.signIn('سارة', 'F12A4XQ') === null);
ok('صف البكالوريا مشتقّ', Store.get().grade === 'g12');

// --- سلامة روابط المحتوى ---
const bad = [];
for (const [id, q] of Object.entries(SEED.questions)) {
  if (!SEED.topics.some((t) => t.id === q.topic)) bad.push(`${id}: موضوع مجهول ${q.topic}`);
  if ((q.type === 'mcq' || q.type === 'multi') && !q.options.some((o) => o.correct))
    bad.push(`${id}: بلا إجابة صحيحة`);
  if (q.type === 'mcq' && q.options.filter((o) => o.correct).length > 1)
    bad.push(`${id}: mcq بأكثر من إجابة صحيحة`);
  if (!q.why) bad.push(`${id}: بلا شرح`);
}
for (const u of SEED.units)
  for (const l of u.lessons) if (!SEED.lessons[l]) bad.push(`وحدة ${u.id}: درس مفقود ${l}`);
for (const [id, l] of Object.entries(SEED.lessons))
  for (const e of l.exercises) if (!SEED.questions[e]) bad.push(`درس ${id}: سؤال مفقود ${e}`);
for (const ex of SEED.exams)
  for (const q of ex.questions) if (!SEED.questions[q]) bad.push(`امتحان ${ex.id}: سؤال مفقود ${q}`);
ok('سلامة روابط المحتوى', bad.length === 0);
bad.forEach((b) => console.log('   ← ' + b));

// --- سلامة الترميز: كشف مبكر لتلف UTF-8 في ملفات الواجهة ---------------------
// هذا الاختبار موجود لأن تحرير هذه الملفات بأدوات ويندوز التي تفترض ترميز
// ANSI يفسد كل النص العربي فيها بصمت. العلامة الفارقة تسلسل «Ø».
const SRC = ['ui.js', 'store.js', 'components.js', 'app.js',
             'data/seed.js', 'data/api.js', 'data/device.js', 'data/sync.js', 'data/media.js',
             'screens/onboarding.js', 'screens/main.js', 'screens/course.js', 'screens/exam.js'];
const corrupt = SRC.filter((f) => /Ø|Ù|Ã˜/.test(fs.readFileSync(dir + f, 'utf8')));
ok('لا تلف في ترميز ملفات الواجهة', corrupt.length === 0);
corrupt.forEach((f) => console.log('   ← ترميز تالف: ' + f));

// الصفحة والأنماط أيضًا: تلفهما لا يظهر في اختبارات المنطق فيمرّ صامتًا
// إلى أن يراه المستخدم على الشاشة.
const ROOT = require('node:path').join(__dirname, '..');
const DOCS = ['index.html', 'css/app.css', 'css/tokens.css', 'sw.js'];
const badDocs = DOCS.filter((f) =>
  /Ø§Ù„|Ù…Ù†|Ã˜/.test(fs.readFileSync(require('node:path').join(ROOT, f), 'utf8')));
ok('لا تلف في ترميز الصفحة والأنماط', badDocs.length === 0);
badDocs.forEach((f) => console.log('   ← ترميز تالف: ' + f));

console.log('\n' + (fail.length ? `${fail.length} فشل` : 'كل الاختبارات نجحت'));
process.exit(fail.length ? 1 : 0);
