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

// --- courseProgress: مؤشر مادة واحدة، لا التطبيق كله --------------------------
// في بيانات العيّنة كورس واحد يغطّي كل الوحدات، فالنتيجة يجب أن تطابق
// subjectProgress القديم رياضيًا — هذا يثبت أن إعادة الحصر لم تكسر الحساب.
const cp = Store.courseProgress('fr-g9-core');
const overall = Store.subjectProgress();
ok('courseProgress.percent يطابق subjectProgress بكورس واحد', cp.percent === overall.percent);
ok('courseProgress يحصر عدد الدروس بدروس هذا الكورس فقط', cp.lessonsTotal === 4);
ok('courseProgress يعيد مجموعة مواضيع هذا الكورس', cp.topicIds instanceof Set && cp.topicIds.size > 0);
ok('كورس غير موجود يعيد صفرًا لا خطأ', Store.courseProgress('لا-وجود-له').percent === 0);

// weakestTopic بمرشِّح مواضيع — يقتصر البحث على المجموعة الممرَّرة فقط
const onlyArticles = new Set(['articles']);
ok('weakestTopic بمرشِّح يتقيّد به', Store.weakestTopic(onlyArticles).id === 'articles');

// --- التنزيلات ---
ok('articles-definis منزَّل ابتداءً', Store.get().downloaded.includes('articles-definis'));
Store.toggleDownload('articles-definis');
ok('يمكن حذف التنزيل', !Store.get().downloaded.includes('articles-definis'));

// --- الحفظ المحلي ---
ok('يُحفظ في localStorage', !!localStorage.getItem('manhaji.v1'));

// --- طابور الرفع ---------------------------------------------------------------
// المصادقة نفسها تُختبر على السيرفر لا هنا: الدالة activate هي المرجع،
// وأي محاكاة محلية لها تختبر كودًا لا يعمل في الإنتاج.
Store.reset();
ok('الطابور يبدأ فارغًا', Store.pending() === 0);

Store.completeLesson('salutations');
ok('إكمال درس يُقيَّد في الطابور', Store.pending() === 1);

Store.recordAttempt('articles', true, 'q-art-1');
ok('محاولة سؤال تُقيَّد', Store.pending() === 2);

const attempt = Store.get().outbox.find((x) => x.entity === 'attempt');
ok('المحاولة تحمل معرّفًا من العميل', !!attempt.id && attempt.id.length > 30);
ok('المحاولة تحمل رمز السؤال', attempt.questionId === 'q-art-1');

Store.recordExam('mock-1', 70);
ok('الامتحان يُقيَّد', Store.pending() === 3);

const keys = Store.get().outbox.map((x) => x.key);
Store.clearOutbox([keys[0]]);
ok('تفريغ انتقائي يحذف المؤكَّد فقط', Store.pending() === 2);

Store.signOut();
ok('الخروج لا يمسح الطابور', Store.pending() === 2);
ok('الخروج يمسح علامة الدخول', Store.get().signedIn === false);

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
             'screens/onboarding.js', 'screens/evicted.js', 'screens/courses.js', 'screens/progress.js',
             'screens/main.js', 'screens/course.js', 'screens/exam.js'];
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
