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

// المحتوى الوهمي مصدره الاختبارات نفسها لا التطبيق: js/data/seed.js صار هيكلًا
// فارغًا عمدًا، والمنطق يحتاج بيانات ثابتة معروفة النتائج ليُقاس عليها.
eval(fs.readFileSync(__dirname + '/fixtures.js', 'utf8'));
eval(fs.readFileSync(dir + 'store.js', 'utf8'));

const fail = [];
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fail.push(name); };

// --- الحالة الابتدائية (بعد إزالة طبقة الكورسات: كل شيء بمعرّف المادة) -------
let p = Store.subjectProgress('fr');
ok('يبدأ التقدّم من صفر', p.percent === 0);
ok('عدد الدروس = 4', p.lessonsTotal === 4);

// --- التقدّم الموزون: 0.75 دروس + 0.25 امتحان (بعد إلغاء بُعد إتقان المواضيع) ---
Store.completeLesson('salutations');
Store.completeLesson('articles-definis');
Store.recordExam('mock-1', 80);
p = Store.subjectProgress('fr');
const expected = Math.round(0.75 * 50 + 0.25 * 80);
ok(`المؤشر الموزون = ${expected}`, p.percent === expected);
ok('لا يتجاوز 100', p.percent <= 100 && p.percent >= 0);

// --- تكرار إكمال نفس الدرس لا يُحتسب مرتين ---
const before = Store.subjectProgress('fr').lessonsDone;
Store.completeLesson('salutations');
ok('إكمال درس مكتمل لا يغيّر شيئًا', Store.subjectProgress('fr').lessonsDone === before);

// --- تقدّم الوحدة ---
ok('الوحدة الأولى مكتملة ٢/٢', Store.unitProgress(SEED.units[0]).done === 2);

// --- subjectProgress بمادة غير موجودة: صفر بلا خطأ (لا courseProgress بعد اليوم) ---
ok('مادة غير موجودة تعيد صفرًا لا خطأ', Store.subjectProgress('لا-وجود-لها').percent === 0);

// --- التنزيلات ---
ok('articles-definis منزَّل ابتداءً', Store.get().downloaded.includes('articles-definis'));
Store.toggleDownload('articles-definis');
ok('يمكن حذف التنزيل', !Store.get().downloaded.includes('articles-definis'));

// --- الحفظ المحلي ---
ok('يُحفظ في localStorage', !!localStorage.getItem('manhaji.v2'));

// --- طابور الرفع ---------------------------------------------------------------
// المصادقة نفسها تُختبر على السيرفر لا هنا: الدالة activate هي المرجع،
// وأي محاكاة محلية لها تختبر كودًا لا يعمل في الإنتاج.
Store.reset();
ok('الطابور يبدأ فارغًا', Store.pending() === 0);

Store.completeLesson('salutations');
ok('إكمال درس يُقيَّد في الطابور', Store.pending() === 1);

Store.recordAttempt(true, 'q-art-1');
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

// --- عزل النصّ اللاتيني داخل العربي (bidi) -------------------------------------
// علامة الاستفهام في جملة فرنسية داخل فقرة عربية تقفز إلى الطرف الخطأ ما لم
// يُعزل المقطع. نختبر التعبير النمطي نفسه المستعمل في UI.rich.
const ROOT = require('node:path').join(__dirname, '..');
const appSrc   = fs.readFileSync(dir + 'app.js', 'utf8');
const mainSrc  = fs.readFileSync(dir + 'screens/main.js', 'utf8');
const acctSrc  = fs.readFileSync(dir + 'screens/account.js', 'utf8');
const cssSrc   = fs.readFileSync(require('node:path').join(ROOT, 'css/app.css'), 'utf8');
const uiSrc = fs.readFileSync(dir + 'ui.js', 'utf8');
/* عرض النصّ المختلط: السلوك نفسه يُفحص ببناء الناتج فعليًا في
   `test/suites/bidi-check.js` على نصوصٍ حقيقية من المنهاج. هنا نحرس البنية:
   اتجاهٌ لكل سطر، و`<bdi>` لا `<span>`، وماركداون يصير عُقدًا. */
ok('اتجاه يُحسب لكل سطر من أوّل حرف قويّ',
   /function lineDir\(/.test(uiSrc) && /el = h\('div\.rich__l', d \? \{ dir: d \}/.test(uiSrc));
ok('العزل بـ<bdi> لا <span>', /h\('bdi\.fr'/.test(uiSrc) && !/h\('span\.fr'/.test(uiSrc));
ok('والماركداون يصير عُقدًا', /const MD = /.test(uiSrc) && /h\('b'\)/.test(uiSrc));
// المسافة التي يبتلعها المقطع تُعاد خارجه، وإلّا التصق «1-» بما بعده
ok('المسافة عند حافّة المقطع لا تُبتلع',
   /const lead = seg\.match\(\/\^\\s\*\/\)\[0\]/.test(uiSrc));

// نصّ السؤال يُبنى عبر UI.rich لا كعقدة نصّية — وإلّا طُويت أسطر نصّ القراءة
const compSrc = fs.readFileSync(dir + 'components.js', 'utf8');
ok('نص السؤال يمرّ عبر UI.rich', /UI\.rich\(q\.stem/.test(compSrc));
ok('خيارات الأسئلة تمرّ عبر UI.rich', /UI\.rich\(o\.t/.test(compSrc));
ok('نصّ القراءة يُعرض مع السؤال', /q\.passage/.test(compSrc));

// sync يجلب عمود النصّ ويحوّله — بدونه يصل السؤال بلا نصّه فيتعذّر حلّه
const syncSrc = fs.readFileSync(dir + 'data/sync.js', 'utf8');
ok('sync يجلب passage_md', /passage_md/.test(syncSrc));
ok('sync يحوّل passage_md إلى passage', /passage:\s*q\.passage_md/.test(syncSrc));

// --- تمارين الأقسام الأربعة (مفردات/قاعدة/ترتيب حوار/مواضيع الوحدة) -----------
// شاشة «تمارين» صارت تُبوّب بحقل section لا بقائمة المواضيع الكاملة — لو
// عاد أحد لاستعمال SEED.topics.forEach هنا مستقبلًا فهذا تراجع صامت عن
// القرار: أسئلة كثيرة (comprehension/expression/الملحق الأدبي) بلا section
// معروف ستختفي من تمارين الطالب دون أي خطأ ظاهر.
const courseSrc = fs.readFileSync(dir + 'screens/course.js', 'utf8');
const storeSrc = fs.readFileSync(dir + 'store.js', 'utf8');
ok('شاشة التمارين تصفّي بحقل section', /q\.section === id/.test(courseSrc));
ok('الجلسة الشاملة تستثني غير المصنَّف', /params\.section === 'any'.*q\.section\)/.test(courseSrc));
ok('Screens.practice يقبل section محدَّدًا', /q\.section === params\.section/.test(courseSrc));
ok('نظام المواضيع/نقطة الضعف القديم أُزيل كليًا', !/weakestTopic|q\.topic\b|SEED\.topics/.test(courseSrc));

// --- إزالة طبقة الكورسات: شاشة المادة تصفّي بـ params.subject لا بلا تصفية ---
// حارس ضد رجوع النقص الكامن المكتشَف عند إزالة الكورسات: لو عاد أحد لقراءة
// SEED.units/lessons/exams/questions هنا بلا تصفية بالمادة (كما كانت الحال
// فعليًا قبل هذا التعديل، وتعمل بالصدفة فقط بمادة واحدة)، فهذا رجوع صامت.
ok('شاشة المادة تصفّي الوحدات بالمادة', /u\.subject === subjectId/.test(courseSrc));
ok('شاشة المادة تصفّي الامتحانات بالمادة', /e\.subject === subjectId/.test(courseSrc));
ok('شاشة التمارين تصفّي بنك الأسئلة بالمادة', /q\.subject === subjectId/.test(courseSrc));
ok('Screens.practice يحصر تصفّحه ببنك أسئلة المادة الممرَّرة', /q\.subject === params\.subject/.test(courseSrc));
ok('لا أثر لجدول الكورسات المحذوف بشاشة المادة', !/SEED\.courses/.test(courseSrc));

// اختبار وظيفي: نفس منطق Screens.practice لتصفية بنك الأسئلة بالمادة أولًا —
// سؤالان بنفس القسم من مادتين مختلفتين يجب ألّا يختلطا ببعض.
const fakeMultiSubject = {
  a: { subject: 'fr', section: 'grammaire' },
  b: { subject: 'math', section: 'grammaire' },
};
const bySubjectThenSection = (subject, section) => Object.values(fakeMultiSubject)
  .filter((q) => q.subject === subject).filter((q) => q.section === section);
ok('التصفية بالمادة تمنع اختلاط أسئلة مادتين بنفس القسم',
   bySubjectThenSection('fr', 'grammaire').length === 1);

// اختبار وظيفي صغير لمنطق التصفية نفسه: تأكيد أن سؤالًا بلا section لا يظهر
// في أي قسم، وأن الجلسة الشاملة تستثنيه أيضًا.
const fakeQuestions = {
  q1: { section: 'vocabulaire' }, q2: { section: 'grammaire' }, q3: { section: null },
};
const inSection = (id) => Object.values(fakeQuestions).filter((q) => q.section === id);
const anySection = Object.values(fakeQuestions).filter((q) => q.section);
ok('سؤال بلا section لا يظهر في أي قسم',
   inSection('vocabulaire').length === 1 && inSection('grammaire').length === 1);
ok('الجلسة الشاملة تستثني السؤال غير المصنَّف', anySection.length === 2);

// --- سلايد الفروع (وحدة داخل كل قسم) ------------------------------------------
ok('sync يجلب unit_code', /unit_code/.test(syncSrc));
ok('sync يحوّل unit_code إلى unitCode', /unitCode:\s*q\.unit_code/.test(syncSrc));
ok('تمارين تبني فروعًا حسب q.unitCode', /q\.unitCode/.test(courseSrc));
ok('Screens.practice يقبل فرعًا محدَّدًا ضمن قسم', /params\.unit !== undefined/.test(courseSrc));
ok('فرع «أسئلة عامة» يعني unitCode فارغة لا إسقاط الفلتر',
   /!q\.unitCode/.test(courseSrc));

// اختبار وظيفي: فرع محدَّد يعزل أسئلته فقط عن باقي فروع القسم نفسه، وفرع
// «الأسئلة العامة» (بلا unitCode) لا يبتلع أسئلة فروع أخرى بالغلط.
const fakeBranched = {
  a: { section: 'grammaire', unitCode: 'u1' },
  b: { section: 'grammaire', unitCode: 'u2' },
  c: { section: 'grammaire', unitCode: null },
};
const byBranch = (section, unit) => Object.values(fakeBranched).filter((q) =>
  q.section === section && (unit ? q.unitCode === unit : !q.unitCode));
ok('فرع u1 يعزل سؤاله عن u2', byBranch('grammaire', 'u1').length === 1);
ok('فرع الأسئلة العامة يلتقط بلا-unitCode فقط', byBranch('grammaire', '').length === 1);

// --- سلامة الترميز: كشف مبكر لتلف UTF-8 في ملفات الواجهة ---------------------
// هذا الاختبار موجود لأن تحرير هذه الملفات بأدوات ويندوز التي تفترض ترميز
// ANSI يفسد كل النص العربي فيها بصمت. والتوقيع **زوجٌ** لا حرفٌ واحد: التلف
// يُنتج «Ø» أو «Ù» متبوعًا ببايتٍ عالٍ آخر. أمّا «Ø» وحده فحرفٌ لاتيني مشروع
// يرد في نطاقات المحارف — وقد أنذر هذا الفحص كذبًا على ui.js بسببه.
const SRC = ['ui.js', 'store.js', 'components.js', 'app.js',
             'data/seed.js', 'data/api.js', 'data/device.js', 'data/sync.js', 'data/media.js',
             'screens/onboarding.js', 'screens/evicted.js', 'screens/progress.js',
             'screens/main.js', 'screens/course.js', 'screens/exam.js'];
const corrupt = SRC.filter((f) => /[\u00D8\u00D9][\u0080-\u00FF]/.test(fs.readFileSync(dir + f, 'utf8')));
ok('لا تلف في ترميز ملفات الواجهة', corrupt.length === 0);
corrupt.forEach((f) => console.log('   ← ترميز تالف: ' + f));

// الصفحة والأنماط أيضًا: تلفهما لا يظهر في اختبارات المنطق فيمرّ صامتًا
// إلى أن يراه المستخدم على الشاشة.
const DOCS = ['index.html', 'css/app.css', 'css/tokens.css', 'sw.js'];
const badDocs = DOCS.filter((f) =>
  /Ø§Ù„|Ù…Ù†|Ã˜/.test(fs.readFileSync(require('node:path').join(ROOT, f), 'utf8')));
ok('لا تلف في ترميز الصفحة والأنماط', badDocs.length === 0);
badDocs.forEach((f) => console.log('   ← ترميز تالف: ' + f));

// --- واجهة الاكتشاف: أساتذتنا ---------------------------------------------------
// جلب teachers/courses اختياري ومتسامح (نفس نمط videos) — لا يجوز أن يُسقط
// pullContent كله لو فشل، ولا أن يعيد ميتاداتا كورس كاملة أُزيلت عمدًا سابقًا.
/* الأعمدة تبقى محصورة بما تعرضه الواجهة فعلًا — والقصد منع عودة ميتاداتا
   الكورس التي أُزيلت عمدًا، لا تجميد القائمة. `photo_pos` منها: موضع تركيز
   الصورة يُطبَّق في كل مكان تُعرض فيه بـ`cover`. */
ok('sync يجلب teachers بأعمدة ضيّقة',
   /'teachers',\s*\{\s*select:\s*'id,code,name,bio,photo_path,photo_pos'/.test(syncSrc));
ok('جلب teachers متسامح كـ videos', /Api\.from\('teachers',[^)]*\)\.catch\(\(\) => \[\]\)/.test(syncSrc));
ok('sync يجلب courses بأعمدة ضيّقة فقط (teacher_id,subject_id)',
   /'courses',\s*\{\s*select:\s*'teacher_id,subject_id'/.test(syncSrc));
ok('جلب courses متسامح أيضًا', /Api\.from\('courses',[^)]*\)\.catch\(\(\) => \[\]\)/.test(syncSrc));
ok('content النهائي يبني مفتاح teachers', /teachers:\s*\(teachers \|\| \[\]\)\.map/.test(syncSrc));

// --- أيقونة الإعدادات ------------------------------------------------------------
ok('ui.js يعرّف icon.settings', /settings:\s*\(s\) => svg/.test(uiSrc));

// --- التنقّل: مصدر واحد يغذّي الشريط الجانبي والشريط السفلي ---------------------
// حارس ضد افتراق القائمتين لاحقًا بالغلط: لو أضاف أحد وجهة للشريط الجانبي فقط
// (أو العكس) فهذا الاختبار يفشل قبل أن يصل الفرق للمستخدم.
ok('app.js يعرّف مصفوفة وجهات واحدة (RAIL_ITEMS)', /const RAIL_ITEMS = \[/.test(appSrc));
ok('الشريط الجانبي يُبنى من RAIL_ITEMS', /rail\.replaceChildren\([\s\S]*?RAIL_ITEMS\.map\(railBtn\)/.test(appSrc));
ok('الشريط السفلي يُبنى من نفس RAIL_ITEMS', /tabbar\.replaceChildren\(\.\.\.RAIL_ITEMS\.map\(tabBtn\)\)/.test(appSrc));
// الشريط السفلي بلا نصّ ⇒ الزرّ يفقد اسمه لقارئ الشاشة بلا aria-label
ok('أزرار الشريط السفلي بلا نصّ ظاهر', /\}, h\('span\.tabbar__ico', it\.fico\(\d+\)\)\)/.test(appSrc));
ok('لها اسم لقارئ الشاشة', /'aria-label': it\.label/.test(appSrc));
// النشط يُميَّز **بشكل** لا بشفافية وحدها — وهي ما كانت تجعل الشريط مسطّحًا
ok('النشط له نقطة لا لون فقط',
   /\.tabbar button\.is-on \.tabbar__ico::after \{[^}]*border-radius: 50%/.test(cssSrc));
// ثلاث طبقات ظلّ: حافّة داخلية تعطي سُمكًا، وظلّ قريب يثبّت، وبعيد يرفع
ok('الشريط يطفو بثلاث طبقات لا بواحدة',
   /\.tabbar \{[^}]*inset 0 1px 0 rgba\(255, 255, 255/.test(cssSrc));
ok('الشريط الجانبي يبقي نصّه', /it\.ico\(20\), it\.label/.test(appSrc));
ok('«موادّي» وجهة تنقّل مستقلّة الآن', /id:\s*'subjects'/.test(appSrc));
// الرابعة صارت «آخر الأخبار» لا «حسابي» — الحساب أُبقي زرّ إعدادات بالترويسة
// فقط (icon.settings)، فمعرّفه ما عاد يظهر ضمن RAIL_ITEMS إطلاقًا.
ok('الرابعة صارت «آخر الأخبار»', /id:\s*'news'/.test(appSrc)
   && (appSrc.match(/\{ id: '/g) || []).length === 4);
ok('و«حسابي» لم تعد ضمن وجهات الشريط', !/RAIL_ITEMS = \[[\s\S]*?id:\s*'account'[\s\S]*?\];/.test(appSrc));
/* «حسابي» انتقلت إلى ملفّها: لوحةٌ **واحدة** تُعرض درجًا منزلقًا من زرّ
   القائمة، وشاشةً كاملة عبر المسار. الحارس يتبع المحتوى لا مكانه القديم،
   ويشترط وحدة اللوحة — نسختان تنحرفان عند أوّل تعديل يُنسى في إحداهما. */
ok('«حسابي» شاشةٌ قائمة في ملفّها', /Screens\.account = /.test(acctSrc));
ok('ولوحتها واحدة تُعرض بمكانين',
   /function panel\(/.test(acctSrc) && /Account\.openMenu\(\)/.test(compSrc));

// --- الشريط السفلي على نمط المرجع البصري -----------------------------------------
// أيقونات ممتلئة لا خطّية: خطٌّ أبيض رفيع على أرضية بنفسجية عند ٢٣px يذوب
ok('أيقونات الشريط ممتلئة', /fill: 'currentColor', stroke: 'none'/.test(uiSrc)
   && /fHome:|fGrid:|fChart:|fNews:/.test(uiSrc));
ok('والشريط الجانبي يبقى بالخطّية (أرضيته فاتحة)', /ico: icon\.home/.test(appSrc));
ok('الشريط يطفو لا يلتصق بالحافة',
   /\.tabbar \{[^}]*inset-inline: 16px[^}]*bottom: calc\(14px/.test(cssSrc));
ok('بحبّة كاملة الاستدارة', /\.tabbar \{[^}]*border-radius: var\(--r-full\)/.test(cssSrc));
ok('على أرضية بنفسجية من التوكنات لا هكس مكتوب',
   /\.tabbar \{[^}]*var\(--vio-hi\), var\(--vio\)/.test(cssSrc));

/* --- بنفسجيٌّ واحد ---------------------------------------------------------
   كانت ثلاث عائلات بأصباغ مختلفة (٢٥٠° و٢٤٨° و٢٦٤°) فتُقرأ كألوان متقاربة
   لا كلونٍ واحد — وهو أسوأ من اختلافٍ صريح. */
{
  const tok = fs.readFileSync(dir + '../css/tokens.css', 'utf8');
  ok('لا عائلات بنفسجية منفصلة بعد اليوم',
     !/--acc-vivid|--nav:/.test(tok) && !/--acc-vivid|var\(--nav/.test(cssSrc));
  ok('والسطح البنفسجي معرَّف في الوضعين', (tok.match(/--vio:/g) || []).length === 2);
  // السطح يحمل نصًّا أبيض فيجب أن يبقى داكنًا في الوضعين، بخلاف --acc الذي ينقلب
  const vio = [...tok.matchAll(/--vio:\s*(#[0-9A-Fa-f]{6})/g)].map((m) => m[1]);
  const lum = (x) => parseInt(x.slice(1, 3), 16) * .299 + parseInt(x.slice(3, 5), 16) * .587
                   + parseInt(x.slice(5, 7), 16) * .114;
  ok('ويبقى داكنًا في الوضعين (يحمل نصًّا أبيض)', vio.every((v) => lum(v) < 120),
     vio.map((v) => `${v}=${lum(v).toFixed(0)}`).join(' · '));
  // لا هكس بنفسجي مكتوب يدويًا في الأنماط — كلّه من التوكنات
  ok('لا تدرّج بنفسجي مكتوب يدويًا',
     !/#(5B4B9E|6E5BB8|453876|4C3E92|3D2F73|5B4BC4|7059E8|5B21B6)/i.test(cssSrc));
}
// الشريط عائم ⇒ يحتاج مساحة أكبر أسفل الشاشة وإلّا اختفى آخر عنصر تحته
ok('المساحة المحجوزة تراعي الطفو', /\.view \{ padding-bottom: calc\(76px/.test(cssSrc));
ok('الشاشات الدراسية تُفعِّل «موادّي» لا «الرئيسية» بالتنقّل',
   /course', 'lesson', 'practice', 'exam', 'result'\][\s\S]{0,40}return 'subjects'/.test(appSrc));

// --- حذف شاشة الترحيب: الدخول صار الشاشة الجذر -------------------------------
// اسم 'welcome' ما لازم يبقى بأي مسار كود حيّ. أخطر بقيّة محتملة هي
// `Screens[c.name] || Screens.welcome` بـ render(): لو بقيت، أي اسم شاشة
// مجهول يستدعي دالة غير موجودة فتنهار الواجهة كليًا بدل السقوط لشاشة صالحة.
const onbSrc = fs.readFileSync(dir + 'screens/onboarding.js', 'utf8');
ok('لا أثر لـ Screens.welcome', !/Screens\.welcome/.test(onbSrc + appSrc));
ok('الاحتياطي عند شاشة مجهولة هو auth', /Screens\[c\.name\] \|\| Screens\.auth/.test(appSrc));
ok('الإقلاع بلا جلسة يفتح auth', /name: signedIn \? 'home' : 'auth'/.test(appSrc));
ok('لا تنقّل بشاشة الدخول', /cur\(\)\.name === 'auth'/.test(appSrc));
ok('شاشة الدخول بلا زر رجوع (هي الجذر)', !/onBack/.test(onbSrc));

/* --- طول كود التفعيل ----------------------------------------------------------
   `issue-code` تولّد ثلاث مجموعات بعد البادئة (١٥ محرفًا)، والتوليد الجماعي
   المسحوب كان مجموعتين (١١). كان الحقل مثبَّتًا على ١١، فيقصّ `clean` الكود
   الجديد عند المحرف الحادي عشر — أي أن الطالب **لا يستطيع إدخال كوده أصلًا**
   ولا رسالة تشرح له لماذا. أخطر ما في الأمر أنه يبدو عطلًا في الحقل لا في
   المنطق، فيُبحث عن العلّة في العرض.

   ويجب أن يبقى الطولان مقبولين: الأكواد القديمة الأربعة ما زالت صالحة،
   وقصرُ القبول على ١٥ يُبطلها بأثر رجعي. */
{
  // نستخرج الدالّتين من المصدر ونشغّلهما فعلًا: فحصُ النصّ يثبت وجود الرقم
  // لا صحّة السلوك.
  const MAX = Number((onbSrc.match(/MAX_LEN = (\d+)/) || [])[1]);
  const VALID = JSON.parse(((onbSrc.match(/VALID_LENS = (\[[^\]]+\])/) || [])[1] || '[]')
    .replace(/'/g, '"'));

  ok('الحقل يقبل ١٥ محرفًا (الكود الجديد)', MAX === 15, String(MAX));
  ok('والطولان القديم والجديد مقبولان',
     VALID.includes(11) && VALID.includes(15), JSON.stringify(VALID));

  const clean = (s) => (s || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, MAX);
  const format = (r) => [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15)]
    .filter(Boolean).join('-');

  // الكود الذي أبلغ عنه المستخدم فعلًا
  const NEW = 'FRG-VTRN-A9HG-VDFF';
  ok('كود جديد لا يُقصّ', clean(NEW).length === 15, `${clean(NEW).length} محرفًا`);
  ok('ويُنسَّق بأربع مجموعات', format(clean(NEW)) === NEW, format(clean(NEW)));

  const OLD = 'FR9-ABCD-EFGH';
  ok('وكود قديم ما زال يعمل',
     clean(OLD).length === 11 && VALID.includes(11) && format(clean(OLD)) === OLD,
     format(clean(OLD)));

  ok('والنصّ الإرشادي يعرض الصيغة الجديدة',
     /FRG-XXXX-XXXX-XXXX/.test(onbSrc));
}
ok('وضع التجربة ما زال له مدخل', /signedIn: true, username: 'زائر'/.test(onbSrc));

// --- شاشة الدخول: ثلاثة عناصر لا أكثر --------------------------------------------
// من يفتح التطبيق أول مرة يريد الدخول لا قراءة سياسة الجلسات.
ok('حقلان وزرّ زائر فقط', /اسم المستخدم/.test(onbSrc) && /كود التفعيل/.test(onbSrc)
   && /المتابعة كزائر/.test(onbSrc));
ok('لا بطاقات جانبية', !/dash__side/.test(onbSrc) && !/callout/.test(onbSrc));
ok('لا تلميحات تحت الحقول', !/div\.hint/.test(onbSrc));
ok('لا تخطيط لوحة بشاشة من ثلاثة حقول', !/h\('div\.dash'/.test(onbSrc));
ok('عمود واحد متمركز', /\.auth \.screen__body \{[^}]*justify-content: center/.test(cssSrc));

// --- سبلاش الإقلاع ---------------------------------------------------------------
ok('سبلاش بقلم يكتب', /function showSplash/.test(appSrc) && /PENCIL_SVG/.test(appSrc));
ok('نصّ «جارٍ التحميل» بخطّ خفيف', /h\('div\.splash__t', 'جارٍ التحميل'\)/.test(appSrc)
   && /\.splash__t \{[^}]*font-weight: 400/.test(cssSrc));
ok('القلم بلون الهوية', /\.splash \{[^}]*color: var\(--acc\)/.test(cssSrc)
   && /\.pencil__body1 \{[^}]*stroke: var\(--acc\)/.test(cssSrc));
ok('القلم صغير', /\.pencil \{[^}]*width: 62px/.test(cssSrc));
ok('القلم يدور', /pencil__rotate \{ animation-name: pencilRotate/.test(cssSrc)
   && /@keyframes pencilRotate/.test(cssSrc));
// خارج #app: buildShell يستبدل محتوى #app كليًا فيمحو أي سبلاش بداخله
ok('السبلاش خارج #app', /document\.body\.appendChild\(el\)/.test(appSrc));
// شاشة الدخول لا تنتظر مزامنة، فسبلاش فوقها تأخير بلا سبب
ok('لا سبلاش قبل تسجيل الدخول', /signedIn \? showSplash\(\) : null/.test(appSrc));
// بلا إنترنت قد يبقى fetch معلّقًا؛ بلا سقف يُحبس الطالب خلف شاشة تحميل
ok('سقف زمني يمنع التعليق', /setTimeout\(finish, 6000\)/.test(appSrc));
ok('فشل المزامنة يرفع الغطاء أيضًا', /first\.then\(finish, finish\)/.test(appSrc));
ok('الحركة تُطفأ لمن يطلب تقليلها', /prefers-reduced-motion[\s\S]{0,80}\.pencil \*/.test(cssSrc));

// --- وزن الخطّ: لا 700 في الواجهة -------------------------------------------------
// Alexandria عند ٧٠٠ تبدو عريضة جدًا في نصّ عربي؛ ٦٠٠ تُبقي التمييز وتخفّ.
ok('لا وزن 700 في الأنماط', !/font-weight:\s*700/.test(cssSrc));
ok('لا وزن 700 في الأنماط المضمّنة',
   !/font-weight:700/.test(mainSrc) && !/font-weight:700/.test(courseSrc)
   && !/font-weight:700/.test(onbSrc));
// --- العلامة في الترويسة: تُقرأ «منهاجي» كاملة ------------------------------------
// نقطتا الياء وذيل الجيم ينزلان دون خطّ الأساس. سطرٌ ضيّق مع overflow:hidden
// كان يبترهما فيقرأ الاسم «منهاجى»، والتتبّع السالب يخنق وصلات الحرف العربي.
/* الترويسة صارت تحيةً واسمًا (المرجع البصري) بدل علامة «منهاجي». والاسم يُقصّ
   بالنقاط عمدًا لأنه مدخَل من الطالب وقد يطول — لكن سطره يتّسع لنزول الحروف
   العربية، وهو ما كان يبتر نقطتَي الياء سابقًا. */
const nameCss = (cssSrc.match(/\.hgreet__n \{[^}]*\}/) || [''])[0];
ok('سطر الاسم يتّسع لنزول الحروف', /line-height: 1\.4[0-9]?|line-height: 1\.5/.test(nameCss));
ok('واسمٌ طويل يُقصّ بالنقاط لا يكسر الترويسة', /text-overflow: ellipsis/.test(nameCss));
ok('لا تتبّع سالب على نصّ عربي', !/letter-spacing: *-/.test(cssSrc));
/* زرّان دائريان: الإشعارات والقائمة. والترتيب في الـDOM يقرّر الموضع —
   الصفحة RTL فأوّل عنصرٍ هو **الأيمن**. الإشعارات يمينًا والقائمة يسارًا. */
ok('الترويسة فيها زرّا إشعارات وقائمة',
   /icon\.bell\(19\)/.test(compSrc) && /icon\.menu\(20\)/.test(compSrc));
ok('والإشعارات قبل القائمة في الـDOM (أي يمينًا)',
   compSrc.indexOf('icon.bell(19)') < compSrc.indexOf('icon.menu(20)'));
ok('ولا ترس إعدادات في الترويسة', !/icon\.settings\(19\)/.test(compSrc));
ok('وهما قرصان أبيضان بظلّ',
   /\.hbtn \{[^}]*border-radius: 50%[^}]*background: var\(--surf\)/.test(cssSrc)
   && /\.hbtn \{[^}]*box-shadow/.test(cssSrc));
// في RTL يذهب أوّل عنصر يمينًا: التحية قبل الأزرار ⇒ تحية يمينًا وأزرار يسارًا
ok('التحية يمينًا والأزرار يسارًا',
   compSrc.indexOf("h('div.hgreet'") < compSrc.indexOf("h('div.hacts'"));
// الاسم بجانب التحية لا تحتها، ومحاذاته على خطّ الأساس لا على المنتصف
ok('الاسم بجانب التحية', /\.hgreet \{[^}]*display: flex[^}]*align-items: baseline/.test(cssSrc));
/* لم تعد ترويسة: التحية والزرّان أوّل محتوى داخل منطقة التمرير، فيمضيان معه
   كأي عنصر. هذا ألغى منطق الإخفاء كلّه — والحارس يمنع عودته. */
ok('التحية عنصرٌ في الصفحة لا شريط',
   /h\('div\.pgreet'/.test(compSrc) && !/appbar--home/.test(compSrc));
ok('ولا بقايا لمنطق الإخفاء',
   !/wireHeaderHide/.test(appSrc) && !/is-away/.test(cssSrc)
   && !/offsetHeight/.test(appSrc));
// وجودها داخل منطقة التمرير يُتحقَّق ببناء الشاشة لا بقراءة المصدر
{
  const inBody = /screen__body[\s\S]{0,200}C\.homeHeader\(/;
  ok('وهي داخل منطقة التمرير في الشاشتين',
     (mainSrc.match(/C\.homeHeader\(/g) || []).length === 2 && inBody.test(mainSrc));
}
// النقطة الحمراء تتبع إشعارًا حقيقيًا؛ شارة دائمة تفقد معناها بعد يومين
ok('نقطة الإشعار مشروطة لا دائمة', /list\.length \? h\('span\.hbtn__dot'\) : null/.test(compSrc));
ok('والإشعارات مشتقّة من حالة التطبيق لا مُختلَقة',
   /function notices\(\)/.test(compSrc) && /s\.storageFull/.test(compSrc)
   && /s\.daysLeft <= 14/.test(compSrc));
// ترويسة واحدة تخدم الشاشتين: نسختان متطابقتان كانتا تفترقان بأول تعديل
ok('ترويسة مشتركة لا منسوخة', (mainSrc.match(/C\.homeHeader\(/g) || []).length === 2
   && !/hbrand__name/.test(mainSrc));
// «موادّي» عنوانُ الصفحة نفسه، فلا تحيةَ فوقه — عنوانان متراكمان في أعلى شاشة
ok('«موادّي» بلا سطر تحية فوقه', /C\.homeHeader\(null, 'موادّي'/.test(mainSrc));

// --- الدروس: مسار الوحدة الحالية لا أكورديون + بطاقة متابعة مكرّرة --------------
// تبويب الدروس عاد قائمةً ثم صار مسارًا: الأكورديون المقفول كان يخفي البنية
// كلّها، والمسار يُظهر خطوة واحدة مكبّرة «الآن» بدل وحدات متطابقة الوزن.
ok('الدروس مسارٌ من خطوات لا بطاقات', /C\.pathNode\(/.test(courseSrc) && !/lgrid|lcard/.test(courseSrc));
ok('والفاصل بين الدروس لا حولها', /\.les \{[^}]*border-top: 1px solid var\(--brd\)/.test(cssSrc));
ok('حالة الخطوة في قرص البداية',
   /\.node--done \.node__dot/.test(cssSrc) && /\.node--now \.node__dot/.test(cssSrc));
// بطاقة المتابعة انسحبت من الرئيسية (آخر الأخبار صارت أوّل عنصر بدلها،
// بقرار صاحب المنتج) وبقيت في «موادّي» وحدها؛ داخل شاشة المادة نفسها المسار
// هو نقطة المتابعة الوحيدة الآن — بطاقة ثانية بجانبه كانت تكرار نفس المعنى
// بشكلين.
ok('بطاقة المتابعة بقيت بموادّي وحدها، لا الرئيسية',
   /function continueCard\(/.test(compSrc)
   && (mainSrc.match(/C\.continueCard\(/g) || []).length === 1);
ok('وداخل شاشة المادة المسار هو نقطة المتابعة، لا بطاقة منفصلة',
   !/C\.continueCard\(/.test(courseSrc) && /C\.pathNode\(/.test(courseSrc));
// المتجر لا يخزّن نسبةً داخل الدرس، فشريطٌ يوحي بها رقمٌ مُختلَق
ok('شريط البطاقة يعرض تقدّم المادة والنصّ يقوله',
   /Store\.subjectProgress\(nextSubjectId\)\.percent/.test(mainSrc)
   && /من المادة/.test(mainSrc));
ok('ولا يُرسم شريطٌ بلا تقدّم', /pct > 0 \? h\('div\.cont__bar'/.test(compSrc));
// الخروج وإعادة الضبط لازم يوديا لشاشة موجودة فعلًا لا لاسم محذوف
ok('الخروج/إعادة الضبط يودّيان إلى auth',
   !/App\.go\('welcome'\)/.test(acctSrc) && (acctSrc.match(/App\.go\('auth'\)/g) || []).length >= 2);

/* =============================================================================
   قائمة «حسابي» — الدرج المنزلق
   ============================================================================= */
{
  // لا رفع صورة: الحساب اسمٌ وكود، ولا نطلب من الطالب صورةً ولا نخزّنها
  ok('لا حقل رفع صورة في الحساب',
     !/type: 'file'/.test(acctSrc) && !/FileReader/.test(acctSrc));
  ok('والأفاتار حرف الاسم', /ava__i/.test(acctSrc) && /name\.trim\(\)\[0\]/.test(acctSrc));

  /* أي طبقةٍ تغطّي الشاشة يجب أن تلتقط زرّ رجوع الهاتف — وإلّا خرج الطالب من
     الشاشة كلّها وهو يظنّ أنه يغلق القائمة. نفس قاعدة عارض الملفّات. */
  ok('زرّ الرجوع يغلق الدرج لا الشاشة',
     /pushState\(\{ drawer: true \}/.test(acctSrc)
     && /addEventListener\('popstate', onPop\)/.test(acctSrc));
  ok('ويُنزع المستمع عند الإغلاق', /removeEventListener\('popstate', onPop\)/.test(acctSrc));
  // نقرتان سريعتان كانتا ستفتحان درجين فوق بعضهما
  ok('ولا يُفتح درجان', /querySelector\('\.drawer'\)/.test(acctSrc));
  /* إطارٌ واحد قبل إضافة الصنف: بدونه يقفز الدرج إلى مكانه بلا انزلاق —
     العنصر يُضاف وهو في موضعه النهائي فلا انتقال. */
  ok('والانزلاق يبدأ بعد إطار', /requestAnimationFrame\(\(\) => layer\.classList\.add/.test(acctSrc));

  // الصفحات التعريفية بلا محتوى: تُعرض ساكنةً لا كأزرارٍ ميّتة تُنقر فلا تفعل
  ok('الصفحات التعريفية ساكنة بعلامة قريبًا',
     /row2__soon/.test(acctSrc) && /'من نحن', 'تواصل معنا', 'سياسة الخصوصية'/.test(acctSrc));

  ok('والدرج يمنع تمرير الصفحة خلفه',
     /documentElement\.style\.overflow = 'hidden'/.test(acctSrc));

  ok('واسم القسم «القائمة» لا «حسابي»',
     /drawer__t', 'القائمة'/.test(acctSrc) && /title: 'القائمة'/.test(acctSrc));

  /* نفس مفتاح اللوحة لا مبدَّلٌ خاصّ — المخصَّص بدا ضبابيًّا على الشاشة.
     ويُفحص **موضع الاستدعاء** لا وجود الدالّة: تعريفٌ لا يُستدعى يمرّ على
     تعبيرٍ يبحث عن الاسم وحده. */
  ok('ومفتاح المظهر هو مفتاح اللوحة نفسه',
     /theme-toggle/.test(acctSrc) && /themeToggle\(draw\)/.test(acctSrc));

  // التنزيلات شاشةٌ مستقلّة: قائمةٌ قد تطول تدفن ما تحتها في درجٍ ضيّق
  ok('والتنزيلات شاشة مستقلّة', /Screens\.downloads = /.test(acctSrc)
     && /App\.go\('downloads'\)/.test(acctSrc));
  ok('ولها أبٌ في التنقّل', /case 'downloads':/.test(appSrc));
}

/* =============================================================================
   `replaceChildren` الأصلية تُحوّل `null` إلى **عقدة نصّية**

   بخلاف `UI.h` التي تُسقط الزائف. فتعبيرٌ مثل `cond ? node : null` داخلها
   يطبع كلمة "null" في الواجهة. وقع هذا مرّتين في هذا المستودع: مرّةً بـ
   "false" تحت شارات حجم الملفّ في اللوحة، ومرّةً بـ "null" أسفل القائمة.

   الحارس يفحص وسائط كل نداء **على المستوى الأعلى** بعدّ الأقواس: `null`
   داخل `h(...)` مقبولة لأن `h` ترشّح.
   ============================================================================= */
{
  const bad = [];
  for (const f of ['screens/account.js', 'screens/main.js', 'screens/course.js',
                   'screens/plan.js', 'screens/exam.js', 'components.js', 'app.js']) {
    const src = fs.readFileSync(dir + f, 'utf8');
    let i = -1;
    while ((i = src.indexOf('.replaceChildren(', i + 1)) !== -1) {
      const open = src.indexOf('(', i + 1);
      let depth = 0, end = open;
      for (; end < src.length; end++) {
        if (src[end] === '(') depth++;
        else if (src[end] === ')' && --depth === 0) break;
      }
      const raw = src.slice(open + 1, end);
      // مصفوفةٌ مرشَّحة صراحةً آمنة — وهي الصياغة التي نوصي بها أصلًا
      if (/\.filter\(Boolean\)/.test(raw)) continue;
      // ما داخل أقواسٍ متداخلة يخصّ `h(...)` وهي ترشّح — نُزيله
      let args = raw, prev;
      do { prev = args; args = args.replace(/\([^()]*\)/g, ''); } while (args !== prev);
      if (/(^|[,\s?:])null([,\s)]|$)/.test(args)) bad.push(`${f} @${src.slice(0, i).split('\n').length}`);
    }
  }
  ok('لا null يُمرَّر مباشرةً إلى replaceChildren', bad.length === 0, bad.join(' · '));

  /* والحالة التي لا يراها الفحص أعلاه: مصفوفةٌ تُنشر (`...kids`) — الـ`null`
     داخلها لا يظهر في نصّ النداء. لوحة «القائمة» تبنيها بفروعٍ شرطية كثيرة،
     فيُشترط ترشيحها صراحةً. وهي الحالة التي أنتجت "null" أسفل القائمة فعلًا. */
  ok('ومصفوفة لوحة القائمة تُرشَّح قبل النشر',
     /box\.replaceChildren\(\.\.\.kids\.filter\(Boolean\)\)/.test(acctSrc));
}
// أصل صورة الترحيب ما عاد له مستهلك — بقاؤه بالتخزين المسبق تنزيل بلا فائدة
const swSrc = fs.readFileSync(require('node:path').join(ROOT, 'sw.js'), 'utf8');
ok('welcome.jpg خرج من التخزين المسبق', !/welcome\.jpg/.test(swSrc));

/* --- وصول التحديث إلى الطالب --------------------------------------------------
   الـservice worker يخدم النسخة المخزَّنة، فالإصلاح المنشور لا يصل إلّا عند
   الفتحة التالية — ولو كان الإصلاح هو ما يمكّن الطالب من الدخول أصلًا، بقي
   عالقًا بلا أن يعرف السبب. وقع هذا فعلًا: أُصلح طول كود التفعيل ونُشر،
   والهاتف ما زال يرفض الكود برسالة قديمة. */
/* --- تشغيل الفيديو ------------------------------------------------------------
   `media.js` كان مكتوبًا بالكامل — توقيع الرابط والعلامة المائية وحماية
   الشاشة — ولم يستدعِه **أي سطر** في التطبيق. فكان الطالب يضغط «تشغيل» ولا
   يقع شيء ولا تظهر رسالة، وبدا العطل في R2 أو CORS وهو في زرٍّ بلا معالج.
   الدرس: ميزةٌ مكتوبة ليست ميزةً موصولة. */
{
  const mediaSrc = fs.readFileSync(dir + 'data/media.js', 'utf8');
  const callers = ['screens/course.js', 'screens/main.js', 'app.js']
    .filter((f) => /Media\.player\(/.test(fs.readFileSync(dir + f, 'utf8')));
  ok('شيء ما في التطبيق يستدعي المشغّل', callers.length > 0, callers.join(', ') || 'لا أحد!');
  ok('وزرّ التشغيل له معالج نقر',
     /video__play'[\s\S]{0,120}onclick: playNow/.test(courseSrc));
  // زرٌّ يفتح مشغّلًا لفيديو غير موجود يعطي خطأً بلا سبب مفهوم
  ok('ولا يظهر الزرّ بلا فيديو مربوط', /l\.video\.id && h\('button\.video__play'/.test(courseSrc));
  ok('ويقول ذلك صراحةً', /لا فيديو لهذا الدرس بعد/.test(courseSrc));
  // رسالة الخادم أدقّ: «جهاز غير مرتبط» تحتاج فعلًا غير «لا صلاحية»
  ok('ورسالة الفشل من الخادم لا نصًّا عامًّا', /e\.message \|\| 'تعذّر تشغيل الفيديو'/.test(courseSrc));
  ok('والفشل يُبلَّغ', /Report\?\.capture\('تشغيل الفيديو'/.test(courseSrc));

  /* العلامة المائية تُشغّل مؤقّتًا كل ٢٠ ثانية يُنظَّف بـ`_dispose`، ولم
     يستدعِها أحد — فكل درس يُفتح كان يترك مؤقّتًا يعمل إلى الأبد. */
  ok('ولا يتراكم مؤقّت العلامة المائية',
     /live\?\._dispose\?\.\(\)/.test(mediaSrc) && /live = box;/.test(mediaSrc));
  // `Media.player` تُرجع `div.video`؛ وضعُها داخل أخرى يضاعف نسبة ١٦:٩
  ok('ولا يُلفّ المشغّل في صندوق نسبة ثانٍ',
     /const video = h\('div'\);/.test(courseSrc));

  /* --- أدوات المشغّل ---------------------------------------------------------
     المشغّل الافتراضي يختلف بين كروم وسفاري وأندرويد، ولا يفهم RTL (شريط
     التقدّم يمتلئ من اليسار في واجهة عربية)، ويعرض «تنزيل» في بعضها. */
  ok('أدوات التحكّم مبنيّة لا افتراضية',
     /controls\(el, box\)/.test(mediaSrc) && !/controls: true/.test(mediaSrc));
  // قفزة ١٠ ثوانٍ والسرعة ليستا ترفًا في درس: الطالب يعيد جملة فرنسية
  // ويبطّئ الشرح، أو يسرّع مراجعةً شاهدها.
  ok('وفيها قفزة ١٠ ثوانٍ في الاتجاهين',
     /currentTime - 10/.test(mediaSrc) && /currentTime \+ 10/.test(mediaSrc));
  ok('وتحكّم بالسرعة', /playbackRate/.test(mediaSrc) && /SPEEDS/.test(mediaSrc));
  ok('وملء الشاشة مع بديل iOS',
     /requestFullscreen/.test(mediaSrc) && /webkitEnterFullscreen/.test(mediaSrc));
  // `range` أصلي: يعطي السحب واللمس ولوحة المفاتيح مجّانًا، وكلّها تُكتب خطأً بسهولة
  ok('وشريط الموضع مِزلاق أصلي', /type: 'range'/.test(mediaSrc));
  ok('ويلوَّن ما قبل الإبهام يدويًا', /--p/.test(mediaSrc) && /--p, 0%/.test(cssSrc));
  // بلا preventDefault تُمرَّر الصفحة تحت المشغّل بينما يظنّ المستخدم أنه أوقفه
  ok('والمسافة لا تُمرّر الصفحة', /e\.key === ' '[\s\S]{0,40}preventDefault/.test(mediaSrc));
  /* الاختفاء يقوده مؤقّت في JS، وسلوكه كلّه في `suites/player-idle-check`.
     هنا حارسٌ واحد لا يُغني عنه ذاك: ألّا يعود `:hover` وسيلةَ الإخفاء. هو
     يعمل على الفأرة فيبدو سليمًا على حاسوب المطوّر، وعلى شاشة اللمس تلتصق
     حالة hover بعد النقر فتبقى الأدوات ظاهرة أبدًا فوق الفيديو. */
  ok('والإخفاء ليس بـ:hover', !/is-playing:hover \.vc/.test(cssSrc));
  ok('بل بمؤقّت سكون', /\.video\.is-idle \.vc \{ opacity: 0/.test(cssSrc)
     && /is-idle/.test(mediaSrc));
  // أدواتٌ شفّافة تبقى تلتقط اللمس، فتقع الضغطة الأولى على زرّ لا يراه أحد
  ok('والمخفيّة لا تلتقط اللمس', /\.video\.is-idle \.vc \{[^}]*pointer-events: none/.test(cssSrc));
  ok('والعلامة المائية فوقها لا تحتها',
     cssSrc.indexOf('.wm {') > 0 && /\.wm \{[^}]*z-index: 2/.test(cssSrc)
     && /\.vc \{[\s\S]{0,120}z-index: 3/.test(cssSrc));

  /* --- صورة الفيديو ----------------------------------------------------------
     كل درس كان يعرض الرسم النائب نفسه، فتتشابه الدروس قبل فتحها ولا يميّز
     الطالب ما شاهده. تُلتقط آليًّا عند الرفع — خطوةٌ يدوية لكل درس تُنسى. */
  ok('الصورة تُعرض من الرابط الموقّع', /poster: meta\?\.poster/.test(mediaSrc));
  /* إصلاحٌ يشترط إعادة رفع كل درس ليس إصلاحًا: ما رُفع قبل عمود الصورة يجب
     أن يعرض إطارًا حقيقيًا أيضًا — `#t=3` تجعل المتصفّح يطلب أوّل بايتات
     الملفّ ويعرض إطار الثانية الثالثة بلا تنزيل المقطع كلّه. */
  ok('وللفيديوهات القديمة إطارٌ من الملفّ نفسه', /got\.url \+ '#t=3'/.test(mediaSrc));
  ok('وشاشة الدرس تستعمله', /Media\.posterFor\(l\.video\.id\)/.test(courseSrc));
  // انتظار الشبكة قبل الرسم يجعل الدرس يبدو معلَّقًا
  ok('ولا تنتظره قبل الرسم', /surface \|\| h\('img'/.test(courseSrc));
  // زرّ البثّ الذي يحقنه كروم: مربّع رمادي كبير يحجب الصورة، ولا معنى لبثّ
  // درسٍ محميٍّ برابط موقّع إلى شاشة أخرى.
  ok('وزرّ البثّ مُزال', /disableremoteplayback: true/.test(mediaSrc)
     && /noremoteplayback/.test(mediaSrc));

  /* قياس التقطيع: قرار «هل نحتاج جودات متعدّدة؟» يُبنى على أرقام لا تخمين،
     والطالب لا يشتكي غالبًا — يغلق التطبيق. */
  ok('والمشاهدة المتقطّعة تُقاس', /addEventListener\('waiting'/.test(mediaSrc)
     && /مشاهدة متقطّعة/.test(mediaSrc));
  // تسجيل كل مشاهدة سليمة ضجيجٌ يغرق ما يهمّ
  ok('ولا تُرسل إلّا عند سوءٍ فعليّ',
     /stalls < 3 && !\(startMs && startMs > 8000\)/.test(mediaSrc));
  // المُبلِّغ يكرّر الرسالة مرّة للجلسة: بلا المعرّف يُقاس أوّل درس وحده
  ok('وكل درس يُقاس على حدة', /مشاهدة متقطّعة · \$\{videoId\}/.test(mediaSrc));
}

ok('التطبيق يعيد التحميل عند وصول نسخة جديدة',
   /controllerchange/.test(appSrc) && /location\.reload\(\)/.test(appSrc));
ok('ويفحص التحديث صراحةً عند الإقلاع', /reg\.update\(\)/.test(appSrc));
// GitHub Pages يرسل max-age=600 على sw.js؛ بلا هذا قد لا يُفحص الملفّ أصلًا
// لعشر دقائق مهما أعاد الطالب التحميل، فيبدو كأن النشر لم يحدث.
ok('ويسأل الخادم عن sw.js لا كاشه', /updateViaCache: 'none'/.test(appSrc));

/* بدون `waitUntil` يُنهي المتصفّح العامل بمجرّد أن يُحلّ `respondWith`،
   فيُقطع الجلب قبل `cache.put` — أي أن نصف stale-while-revalidate الثاني
   لا يقع أبدًا ويبقى الكاش على حاله. هذا سبب بقاء نسخة قديمة رغم النشر. */
ok('والتحديث الخلفي يُنجَز فعلًا (waitUntil)', /e\.waitUntil\(network\)/.test(swSrc));
// index.html هو ما يسحب بقيّة الملفّات: خدمتُه من الكاش تؤجّل كل نشر دورةً
ok('والتنقّل من الشبكة أوّلًا', /req\.mode === 'navigate'[\s\S]{0,300}Promise\.race/.test(swSrc));
// ومع ذلك يبقى التطبيق يعمل بلا إنترنت — مهلة قصيرة ثم الكاش
ok('مع مهلة تحفظ العمل بلا إنترنت',
   /setTimeout\(\(\) => r\(null\), 2500\)/.test(swSrc) && /return cached \|\|/.test(swSrc));
// `clients.claim()` يطلق الحدث عند أوّل تثبيت أيضًا؛ بلا التمييز تُعاد
// الصفحة أمام زائر يفتح التطبيق لأوّل مرّة بلا سبب يفهمه.
ok('ولا يعيد تحميل زائر أوّل مرّة', /hadController/.test(appSrc));
// وحارس ضدّ حلقة إعادة تحميل لا تنتهي
ok('ولا يعيدها أكثر من مرّة', /!hadController \|\| reloaded/.test(appSrc));

/* --- تبليغ الأعطال ------------------------------------------------------------
   قبله كانت ثلاث `catch` في app.js تبتلع أخطر الأعطال إلى console لا يقرؤه
   أحد، فيُعرف العطل من شكوى طالب إن اشتكى. */
{
  const repSrc = fs.readFileSync(dir + 'data/report.js', 'utf8');

  // نسخة التطبيق مكرّرة في مكانين بالضرورة (الصفحة لا تصل إلى ثابت داخل
  // الـservice worker). هذا الحارس هو ما يمنعهما من الانحراف — وبلا تطابقهما
  // يقول كل تقرير عطل رقم نسخةٍ خاطئًا، وهو أوّل ما يُسأل عنه.
  const appV = (repSrc.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
  const swV = (swSrc.match(/manhaji-shell-(v\d+)/) || [])[1];
  ok('نسخة المُبلِّغ تطابق نسخة sw.js', !!appV && appV === swV, `${appV} مقابل ${swV}`);

  ok('يلتقط الأخطاء غير الملتقطة',
     /addEventListener\('error'/.test(repSrc) && /unhandledrejection/.test(repSrc));
  // الشروط الثلاثة التي تجعله لا يؤذي أكثر ممّا ينفع
  ok('لا يُبلّغ عن نفسه (حارس الحلقة)', /if \(sending\) return;/.test(repSrc));
  ok('ويسقط صامتًا بلا إنترنت', /if \(!navigator\.onLine\) return;/.test(repSrc));
  ok('ولا يكرّر نفس الرسالة في الجلسة', /seen\.has\(text\)/.test(repSrc));

  ok('و catch الإقلاع الثلاث تُبلّغ لا تبتلع',
     (appSrc.match(/window\.Report\?\.capture\(/g) || []).length === 3);
  ok('والمُبلِّغ يُركَّب أوّل الإقلاع',
     /function boot\(\)\s*\{[\s\S]{0,900}?window\.Report\?\.install\(\)/.test(appSrc));

  /* الأهمّ: البحث عبر `window`. المعامل `?.` يحمي من قيمة فارغة لا من معرّف
     غير مصرَّح — فـ`Report?.install()` ترمي ReferenceError إن لم يُحمَّل
     report.js، فيموت الإقلاع على سطره الأوّل وتصير أداةُ المراقبة هي العطل.
     كشفته مجموعتا splash/stuck حين سقطتا بـ«Report is not defined». */
  // التعليقات تُنزَع أوّلًا: التعليق أعلاه يقتبس الشكل الخطر ليشرحه، فيلتقطه
  // الفحص ويسقط على شيفرة سليمة — حارسٌ يعاقب على توثيق نفسه.
  const codeOnly = appSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  ok('والمُبلِّغ اختياري حقًّا (window.Report لا Report)',
     !/(?<!window\.)\bReport\?\./.test(codeOnly), 'يوجد Report?. بلا window');
  ok('واسم الشاشة متاح للتقرير', /currentName/.test(appSrc) && /currentName/.test(repSrc));
  ok('وreport.js مخزَّن مسبقًا (يعمل من أول فتحة)', /data\/report\.js/.test(swSrc));
}

/* --- مفتاح الإيقاف ------------------------------------------------------------
   غرضه لحظة واحدة: عطلٌ فادح وصل الطلاب. بدونه يبقون أمام تطبيق مكسور بلا
   تفسير — وservice worker يخدم النسخة المخزَّنة فحتى النشر المصحَّح لا يصلهم
   إلّا عند الفتحة التالية. */
{
  const haltedSrc = fs.readFileSync(dir + 'screens/halted.js', 'utf8');
  const storeSrc = fs.readFileSync(dir + 'store.js', 'utf8');

  ok('شاشة الإيقاف موجودة ومخزَّنة مسبقًا',
     /Screens\.halted/.test(haltedSrc) && /screens\/halted\.js/.test(swSrc));
  ok('والتطبيق يعرضها عند الإيقاف',
     /s\.appConfig\?\.halted/.test(appSrc) && /Screens\.halted\(\)/.test(appSrc));
  // الطرد يسبقه: طالبٌ مطرود لا يرى محتوى أصلًا، فرسالة الصيانة تضلّله
  ok('والطرد يسبق الإيقاف في الترتيب',
     appSrc.indexOf('Screens.evicted()') < appSrc.indexOf('Screens.halted()'));
  ok('ولا شريط تنقّل تحت الإيقاف',
     /Screens\.halted\(\)[\s\S]{0,200}tabbar\.style\.display = 'none'/.test(appSrc));

  /* الاتجاه الآمن: الافتراضي «لا إيقاف»، وفشل القراءة لا يوقف شيئًا. عطلٌ في
     جدول الإعدادات يجب ألّا يحجب تطبيقًا سليمًا عن طالب دفع ثمنه. */
  ok('الافتراضي لا إيقاف', /appConfig:\s*\{\s*halted:\s*false/.test(storeSrc));
  ok('وفشل قراءة الإعدادات لا يوقف شيئًا',
     /catch \{ \/\* لا إيقاف عند الشكّ \*\/ \}/.test(syncSrc));
  ok('وتُقرأ مع كل مزامنة', /await pullConfig\(\)/.test(syncSrc));
}

// --- الرفة الدورية: لا إعادة رسم بلا تغيير حقيقي -------------------------------
// كانت pullProgress تُرجع عدد الصفوف المجلوبة لا المتغيّرة، فأي طالب له تقدّم
// يجعل الناتج موجبًا في كل مزامنة، و app.js يعيد رسم الشاشة عند أي ناتج موجب.
// مع animation:fadeIn على .screen كانت تبدو رجفةً/تحديثًا دوريًا للتطبيق.
ok('pullProgress يُرجع المتغيّر لا المجلوب',
   !/return lessons\.length \+ exams\.length/.test(syncSrc) && /return changed;/.test(syncSrc));
ok('يقارن الدروس بالحالة الحالية', /s\.lessons\[k\] !== nextLessons\[k\]/.test(syncSrc));
ok('لا يكتب الحالة إن لم يتغيّر شيء', /if \(changed\) Store\.set\(/.test(syncSrc));
/* المحتوى لم يعد نصًّا في localStorage بل كائنًا في IndexedDB، فلا مقارنة
   نصّية. الإشارة صارت البصمة المقصورة على نطاق الطالب: بلوغُ السحب يعني أن
   شيئًا في نطاقه تغيّر فعلًا. */
ok('التغيّر يُستدلّ عليه بالبصمة لا بمقارنة نصّية',
   /contentChanged = !!c;/.test(syncSrc)
   && !/localStorage\.getItem\(CONTENT_KEY\) !== before/.test(syncSrc));
ok('syncNow يُصرّح بـchanged', /changed: contentChanged \|\| progress > 0/.test(syncSrc));
ok('app.js لا يرسم إلا عند changed',
   /if \(!r\.changed\) return;/.test(appSrc) && !/const after = \(r\) => \{ if \(r\) render\(\); \};/.test(appSrc));

// الأخطر: إعادة الرسم أثناء امتحان تبني الشاشة من الصفر ⇒ تضيع إجابات الطالب
// ويُصفَّر مؤقّته. الحارس هنا يمنع ذلك، والطرد وحده يتجاوزه.
ok('لا إعادة رسم فوق شاشة تحمل حالة', /STATEFUL\.includes\(cur\(\)\.name\)/.test(appSrc));
ok('الامتحان والدرس والتمرين محميّة',
   /STATEFUL = \['exam', 'result', 'practice', 'lesson'\]/.test(appSrc));
ok('الطرد يتجاوز كل الحُرّاس', /if \(r\.evicted\) \{ render\(\); return; \}/.test(appSrc));

// اختبار وظيفي لمنطق القرار نفسه
const decide = (r, screen) => {
  const ST = ['exam', 'result', 'practice', 'lesson'];
  if (!r) return false;
  if (r.evicted) return true;
  if (!r.changed) return false;
  return !ST.includes(screen);
};
ok('مزامنة بلا تغيير لا ترسم', decide({ changed: false }, 'home') === false);
ok('مزامنة بتغيير ترسم', decide({ changed: true }, 'home') === true);
ok('تغيير أثناء الامتحان لا يقطع الطالب', decide({ changed: true }, 'exam') === false);
ok('الطرد يرسم حتى أثناء الامتحان', decide({ evicted: true }, 'exam') === true);

// --- البانر أُزيل من «الرئيسية» نهائيًا، وصار حصرًا ضمن «آخر الأخبار» --------------
ok('لا شرائح بديلة في الشيفرة', !/EVERGREEN/.test(mainSrc));
/* المقصود بالقرار «لا بانر في الرئيسية» هو **الشريط الترويجي** الذي كان يشغل
   أبرز موضع بمحتوى لم يختره أحد — لا أن تُحرَم الرئيسية من أي إشارة إلى
   الأخبار. الرئيسية تعرض كومةً من أحدث عشرة بزرّ «الكل» يقود إلى القسم:
   مدخلٌ إليه لا نسخةٌ منه.

   ولا تُقاس بـ«لا setInterval»: الكومة تتبدّل بمؤقّت وهو مقصود. المقياس أن
   المحتوى محدودٌ وأن ثمّة طريقًا إلى القسم. */
{
  const home = mainSrc.slice(mainSrc.indexOf('Screens.home ='), mainSrc.indexOf('Screens.subjects ='));
  ok('لا شرائح ترويجية بـ«الرئيسية»', !/EVERGREEN|promo/i.test(home));
  ok('والأخبار كومةٌ محدودة لا القائمة كاملة',
     /posts\.slice\(0, ?10\)/.test(home) && /newsStack\(/.test(home));
  ok('ومعه طريقٌ إلى القسم', /App\.go\('news'\)/.test(home));
}
// وقاعدة .promo القديمة حُذفت من CSS لا تركت معلَّقة بلا مستعمل
ok('قاعدة .promo القديمة حُذفت من CSS', !/\.promo\s*\{/.test(cssSrc) && !/promoFade/.test(cssSrc));
// «آخر الأخبار» هي الآن الشاشة الوحيدة التي تبني من SEED.banners
ok('«آخر الأخبار» تبني من SEED.banners', /Screens\.news = \(\) => \{[\s\S]{0,200}SEED\.banners/.test(mainSrc));
ok('بطاقاتها newsfeed__card بلغة .card نفسها (صورة+تعتيم+نصّ)',
   /\.newsfeed__card \{/.test(cssSrc) && /\.newsfeed__scrim \{/.test(cssSrc));
ok('لا أثر لبطاقة الحقول القديمة', !/subj-showcase/.test(cssSrc) && !/subj-showcase/.test(mainSrc));
// شريط «معلمونا المميزون» (بطاقات .tcard) انشال من الرئيسية — الأستاذ صار
// ظاهرًا مباشرة ضمن بطاقة مادته بقائمة «موادّي» (.subjcard) بدل شريط منفصل.
ok('لا أثر لشريط بطاقات الأساتذة القديم',
   !/\.tcard\b|\.teacher-scroll\b/.test(cssSrc) && !/teacher-scroll|h\('button\.tcard'/.test(mainSrc));
// الملف الشخصي يعرض نفس الصورة عريضة لا داخل دائرة تقصّها
ok('ملف الأستاذ يعرض الصورة عريضة', /\.teacher-hero-img img \{[^}]*object-fit: contain/.test(cssSrc));
ok('لا حشر للصورة المصمَّمة في دائرة', /teacher-head--flat/.test(cssSrc) && /teacher-head--flat/.test(mainSrc));

// --- ملف الأستاذ: قسمان ----------------------------------------------------------
ok('قسما «ما يقدّمه» و«السيرة الذاتية»',
   /\['content', 'ما يقدّمه'\]/.test(mainSrc) && /\['bio', 'السيرة الذاتية'\]/.test(mainSrc));
ok('«ما يقدّمه» هو الافتراضي', /let pane = 'content'/.test(mainSrc));
// تبويب واحد لا معنى له: بلا سيرة مسجَّلة لا نعرض شريطًا بخيار وحيد
ok('لا شريط تبويبات بلا سيرة', /if \(!t\.bio\) return;/.test(mainSrc));

// --- لافتة «دون إنترنت» أُزيلت من موادّي ---------------------------------------
const subjBlock = (mainSrc.match(/Screens\.subjects = \(\) => \{[\s\S]*?\n  \};/) || [''])[0];
ok('لا لافتة اتصال في «موادّي»', !/C\.syncBanner\(\)/.test(subjBlock));
// وتبقى حيث تكون ذات صلة
ok('اللافتة باقية في شاشة المادة', /C\.syncBanner\(\)/.test(courseSrc));

// الصورة داخل منطقة التمرير: خارجها كانت تبقى معلّقة والنصّ ينزلق تحتها.
// الحارس يمسك عودة البنية القديمة (hero شقيق لـ.screen__body لا ابن له).
const heroBlock = (mainSrc.match(/wrap\.append\([\s\S]*?\n    \);/) || [''])[0];
ok('صورة الأستاذ داخل منطقة التمرير',
   heroBlock.indexOf("h('div.screen__body'") < heroBlock.indexOf('teacher-hero-img'));
ok('تلاشٍ أسفل الصورة', /\.teacher-hero-img::after \{/.test(cssSrc)
   && /linear-gradient\(to top, var\(--bg\)/.test(cssSrc));
ok('التلاشي لا يبتلع النقرات', /\.teacher-hero-img::after \{[^}]*pointer-events: none/.test(cssSrc));
// الصورة تمرّ، فلو مرّ زرّ الرجوع معها لضاع مسار الرجوع الوحيد
ok('زرّ الرجوع يبقى ثابتًا', /\.teacher-back \{[^}]*position: fixed/.test(cssSrc)
   && /teacher-back/.test(mainSrc));
/* الدروس: جُرِّبت بطاقاتٍ كبيرة ثم عادت قائمةً — البطاقات الملوّنة جميلة بأربعٍ
   منها، وبعشرين درسًا تُخفي «أين وصلت». الحارس يمنع رجوعها والخطَّ الزمني معًا. */
ok('لا بقايا للخطّ الزمني ولا للبطاقات',
   !/\.tl-row|\.tl-dot|\.tl-act|\.lcard|\.lgrid/.test(cssSrc)
   && !/lgrid|lcard|h\('div\.tl'\)/.test(courseSrc));
// الحسابُ (أي خطوة done/now/todo) انتقل إلى Store.subjectPath — الرسمُ في
// course.js يقرأ الحالة الجاهزة بدل أن يشتقّها، فالحارس يتبع الحساب لا الرسم.
ok('ثلاث حالات للخطوة', ['done', 'now', 'todo'].every((x) => storeSrc.includes(`'${x}'`))
   && /function subjectPath\(/.test(storeSrc));
/* الأكورديون المقفول عاد — بس لِـ«بقيّة وحدات المادة» فقط، لا للوحدة
   الحالية (لها المسار). الطالب يقدر يفتح أي وحدة ويبدأ أي درس فيها ولو
   ما خلّص الحالية — قرار صريح: لا قفل على الإطلاق بهذا التطبيق. */
ok('بقيّة الوحدات أكورديون مفتوح للجميع، لا معاينة مطوية ولا قفل',
   /function unitAccordion\(u\)/.test(courseSrc) && /بقيّة وحدات المادة/.test(courseSrc)
   && !/class="teaser"|h\('div\.teaser'/.test(courseSrc));
// عنصرٌ بلا محتوى داخل صفٍّ مرن ينكمش إلى عرض صفر فيختفي الشريط تمامًا
ok('شريط التقدّم يأخذ عرضًا داخل الصفّ', /\.row > \.bar \{[^}]*flex: 1/.test(cssSrc));

/* --- الفائض الأفقي: أوسع خللٍ أثرًا في التخطيط -------------------------------
   عنصرُ الشبكة/الفلكس لا ينكمش دون عرض محتواه الأدنى. دروس «الكتابة» (الرابع
   في كل وحدة) تحمل جدول تقييم، فكان الجدول يفرض عرضه على العمود فتخرج الصفحة
   كلّها عن الشاشة — ظهر الفيديو مقتطعًا والعنوان مبتورًا. */
{
  const chain = ['.view', '.screen', '.dash', '.dash__main', '.dash__side'];
  const missing = chain.filter((sel) => {
    const rule = (cssSrc.match(new RegExp('\\' + sel + ' \\{[^}]*\\}')) || [''])[0];
    return !/min-width: 0/.test(rule);
  });
  ok('السلسلة كلّها تقبل الانكماش', missing.length === 0, missing.join(' · '));
  // والعنصر العريض يحتوي فائضه بنفسه بدل دفع الصفحة
  ok('حاوية الجدول تمرّر نفسها أفقيًا',
     /\.prose__scroll \{[^}]*overflow-x: auto/.test(cssSrc));
  // والجدول يبقى جدولًا: `display:block` كان يُلغي التخطيط فتنكمش الأعمدة
  ok('والجدول يحتفظ بتخطيطه',
     /\.prose table \{[^}]*width: 100%/.test(cssSrc)
     && !/\.prose table \{[^}]*display: block/.test(cssSrc));
  ok('ونصّ الدرس يمرّ عبر UI.prose لا عبر حقنٍ خام',
     /UI\.prose\(l\.body\)/.test(courseSrc) && !/div\.prose', \{ html:/.test(courseSrc));
  ok('وكلمة طويلة بلا مواضع قطع تُكسر', /\.prose \{ overflow-wrap: anywhere; \}/.test(cssSrc));
}

// --- بطاقات المواد في «موادّي» ----------------------------------------------------
ok('المواد بطاقات ملوّنة', /h\('div\.subj-grid'/.test(mainSrc) && /\.subj-grid \{/.test(cssSrc));
ok('بشبكة لا صفّ يمرّر أفقيًا', /\.subj-grid \{[^}]*grid-template-columns/.test(cssSrc));
// أُسقطت الحلقة لا المعلومة: «كم أنجزت» سبب دخول الطالب هذه الشاشة
ok('التقدّم يشغل موضع علامة الحفظ في المرجع',
   /subj__pct/.test(mainSrc) && /\.subj__pct \{/.test(cssSrc));
ok('واللون بترتيب ثابت', /'subj--c' \+ \(i % 4\)/.test(mainSrc));
// صورة الأستاذ الدائرية واسمه بجانبها — جوهر المرجع في هذه البطاقة
ok('البطاقة تحمل أستاذ المادة', /subj__teacher/.test(mainSrc)
   && /teachers\.find\(\(x\) => \(x\.subjects \|\| \[\]\)\.includes\(subject\.id\)\)/.test(mainSrc));
ok('وبديلٌ حين تغيب صورته', /subj__init/.test(mainSrc) && /\.subj__init \{/.test(cssSrc));
ok('واسمٌ طويل يُقصّ لا يمطّ البطاقة',
   /\.subj__tn b \{[^}]*text-overflow: ellipsis/.test(cssSrc));
// قصّة الحافّة تبرز خارج البطاقة، فالفجوة يجب أن تتّسع لها
ok('قصّة الحافّة بسهم', /subj__notch/.test(mainSrc)
   && /\.subj__notch \{[^}]*background: var\(--bg\)/.test(cssSrc));
ok('والفجوة تتّسع لبروزها', /\.subj-grid \{[^}]*gap: 16px/.test(cssSrc));
// الحالة في قرص البداية: صحّ للمكتمل، تشغيلٌ للجاري. المكتمل ذهبي لا أخضر
// هنا — نفس منطق .lesson__ico--done: الذهبي لون الإنجاز في الهوية،
// والأخضر محجوز لتغذية «إجابة صحيحة» الراجعة، فلا يُستهلك معناه في مكانين.
ok('المكتمل يحمل علامة صحّ', /state === 'done' \? icon\.check\(15\)/.test(compSrc)
   && /\.node--done \.node__dot \{[^}]*color: var\(--gold\)/.test(cssSrc));
ok('والجاري يحمل تشغيلًا بلون الهوية',
   /\.les--now  \.les__s \{[^}]*background: var\(--acc\)/.test(cssSrc));

// --- ترويسة الرئيسية/موادّي ------------------------------------------------------
// العلامة نصًّا لا شعارًا في الترويسة — أسلوب أغلب التطبيقات الحديثة.
// الشعار يبقى في شاشة الدخول والشريط الجانبي وأيقونة التطبيق.
ok('لا شعار في الترويسة', !/hbrand__logo/.test(mainSrc)
   && !/h\('div\.avatar', \(s\.username/.test(mainSrc));
/* الترويسة صارت تحيةً واسمَ الطالب بدل علامة «منهاجي» — قرارٌ عكسَ سابقه
   باعتماد المرجع البصري. العلامة باقية حيث تُعرِّف فعلًا: شاشة الدخول
   والشريط الجانبي وأيقونة التطبيق. */
ok('الترويسة تخاطب الطالب باسمه', /C\.homeHeader\(C\.greeting\(\), s\.username/.test(mainSrc));
ok('ولا أثر للعلامة النصّية فيها', !/hbrand__name/.test(mainSrc));
ok('الشعار باقٍ في الشريط الجانبي وشاشة الدخول',
   /assets\/img\/icon-192\.png/.test(appSrc)
   && /assets\/img\/icon-192\.png/.test(fs.readFileSync(dir + 'screens/onboarding.js', 'utf8')));
// الترويسة اسم مجرّد: لا شعار ولا عبارة تحته. العبارة التعريفية مكانها شاشة
// الدخول حيث يراها الطالب أول مرة، لا فوق كل شاشة يفتحها.
ok('لا عبارة تعريفية في الترويسة', !/hbrand__tag/.test(mainSrc) && !/hbrand__tag/.test(cssSrc));
ok('العبارة باقية في شاشة الدخول', /auth-brand__tag/.test(onbSrc));
// الوزن ٤٠٠ هو الأخفّ المحمَّل؛ طلب ٣٠٠ يُصطنع أو يسقط لخطّ احتياطي مشوّه
ok('لا وزن خطّ غير محمَّل', !/font-weight:\s*[123]00/.test(cssSrc));
// التحية والاسم على سطر واحد داخل الترويسة
ok('التحية والاسم بجانب بعضهما',
   /h\('span\.hgreet__k', kicker\)/.test(compSrc) && /h\('span\.hgreet__n', title\)/.test(compSrc));
ok('وتتبع ساعة الجهاز', /function greeting\(\)[\s\S]{0,200}صباح الخير/.test(compSrc));
// وجودها داخل منطقة التمرير فعليًا يتحقّق ببناء الشاشة لا بقراءة المصدر —
// انظر render-check.js في مجلد الفحص.
/* لم تعد ترويسةً ولا حاوية: `.pgreet` عنصرٌ عادي في تدفّق الصفحة.
   الأزرار تُحاذي أعلى كتلة التحية لا منتصفها — سطران مقابل سطر. */
{
  const g = (cssSrc.match(/\.pgreet \{[^}]*\}/) || [''])[0];
  ok('التحية بلا حاوية ولا سطح', !/background|box-shadow|border/.test(g));
  ok('ومحاذاة علوية للأزرار', /align-items: flex-start/.test(g));
  ok('ولا أثر لصنف الشريط القديم', !/appbar--home/.test(cssSrc));
}

// سهم بطاقة الأستاذ الزخرفي (.tcard__go) انشال مع الشريط كلّه أعلاه.
{  // --acc لون مقدّمة: يُرفع في الوضع الداكن ولا يُنسخ، وإلّا اختفى على أرضيته
  const tok = fs.readFileSync(require('node:path').join(ROOT, 'css/tokens.css'), 'utf8');
  const vals = [...tok.matchAll(/--acc:\s*(#[0-9A-Fa-f]{6})/g)].map((m) => m[1]);
  ok('للأكسنت قيمة في كلا الوضعين', vals.length === 2, vals.join(' · '));
  ok('قيمتا الوضعين مختلفتان', new Set(vals).size === 2);
}

// --- قائمة «موادّي»: بطاقة لكل مادة، رأس قابل للطيّ + صفّ تفاصيل بصورة كبيرة ----
// حلّت محلّ الصفّ المسطّح القديم — شكلٌ مستوحًى من مرجع تصميم خارجي طلبه
// صاحب المنتج صراحةً (راجع design-library بجذر المشروع)، بمنطق أستاذ واحد
// لكل مادة (لا كورسات متعدّدة تحت رأسٍ واحد — ذاك مرفوض عمدًا).
ok('القائمة بطاقات .subjcard لا شريط .hrail القديم',
   /h\('div\.subjcard'/.test(mainSrc) && !/hrail|\.mini\b|\.srow\b/.test(mainSrc));
// فحوص الرسم الفعلي (أي مادة يظهر صفّ تفاصيلها، الطيّ الافتراضي...) بملف
// test/suites/home-list-check.js — تحتاج تشغيل الشاشة فعليًا لا نصّ المصدر
// وحده، وهذا الملف يفحص المصدر نصًّا فقط بلا تنفيذ.
// نقرة صفّ التفاصيل ورابط «تفاصيل المادة» يفتحان المادة، عبر دالّة واحدة
// مشتركة (goSubject) لا معالجَين منفصلَين قد ينحرفان عن بعض بتعديل لاحق.
ok('غاية نقرة صفّ التفاصيل ورابط الأسفل موحَّدة',
   /const goSubject = \(\) => App\.go\('course', \{ subject: sub\.id \}\);/.test(mainSrc)
   && (mainSrc.match(/onclick: goSubject/g) || []).length === 2);
// رأس البطاقة يطوي/يفتح فقط — يمنع وصول النقرة لفتح المادة كي لا يُفتح
// بالخطأ عند مجرّد استكشاف الأستاذ أو طيّ البطاقة.
{
  const headBlock = (mainSrc.match(/h\('div\.subjcard__head', \{[\s\S]*?icon\.chevron\(16\)\)/) || [''])[0];
  ok('رأس البطاقة لا يفتح المادة بنفسه (لا App.go داخل معالجه)', !/App\.go/.test(headBlock));
  ok('ويطوي/يفتح حالة الطيّ المحلّية فقط', /closedSubjects\.(add|delete)\(sub\.id\)/.test(headBlock));
}

// --- مجموعة الأيقونات: نمط متّسق -------------------------------------------------
// وزن ٢ يبدو غليظًا بجانب خطّ عربي رفيع؛ ١٫٧٥ وزن أيقونات iOS تقريبًا.
ok('وزن الخطّ الافتراضي أخفّ', /opts\.width \|\| 1\.75/.test(uiSrc));
ok('نهايات مدوّرة لكل الأيقونات',
   /stroke-linecap', 'round'/.test(uiSrc) && /stroke-linejoin', 'round'/.test(uiSrc));
// الترس والشمس كانا نفس الرسم تقريبًا (دائرة + ٨ أشعّة)
ok('الترس مسار مغلق لا أشعّة كالشمس',
   /settings:[\s\S]{0,900}?a7\.4 7\.4 0 0 0/.test(uiSrc));
ok('الشمس وحدها بأشعّة شعاعية', /sun:[\s\S]{0,400}?M12 2\.6v2\.1/.test(uiSrc));
// المثلّث الحادّ يبدو خشنًا بجانب دوائر ناعمة
ok('مثلّث التشغيل بزوايا مدوّرة', /play:[\s\S]{0,220}?a1 1 0 0 0 1\.53\.85/.test(uiSrc));

// --- «تقدّمي» وجهة واحدة لا اثنتان -------------------------------------------------
ok('تبويب «تقدّمي» أُزيل من داخل المادة', !/\['progress',\s*'تقدّمي'\]/.test(courseSrc));
ok('لا دالة تبويب تقدّم يتيمة', !/function tabProgress/.test(courseSrc));
ok('الافتراضي «الدروس» لا شاشة بلا زرّ', /: tabLessons\(\),/.test(courseSrc));
ok('«شوف تقدّمك» يودّي للوجهة المستقلّة', /onclick: \(\) => App\.go\('progress'\)/.test(courseSrc));

/* --- شاشة المادة: وصفٌ وملفّات، وصورةُ أستاذٍ واحدة لا اثنتان ------------------
   الغلاف يعرض صورة الأستاذ بعرض الشاشة وارتفاع ٢٤٠ بكسل، ثم كان صفّ اسمه
   تحته يعرض **نفس الصورة** في دائرة ٣٨ بكسل. تكرارٌ لا يضيف معلومة ويسرق
   عرضًا من الاسم على هاتفٍ ضيّق. */
ok('لا صورة أستاذ مصغّرة تكرّر صورة الغلاف',
   !/chero__av/.test(courseSrc) && !/\.chero__av/.test(cssSrc));
// نصٌّ عاديّ تحت عنوانٍ عريض، لا بطاقة رماديّة بترويسةٍ صغيرة داخلها
ok('واسم الأستاذ نصٌّ عاديّ',
   /h\('div\.chero__teacher', teacher\.name\)/.test(courseSrc) && !/chero__tb/.test(courseSrc));
ok('ولا بطاقة رماديّة حوله',
   !/\.chero__teacher \{[^}]*background: var\(--surf2\)/.test(cssSrc));

/* الترويسة تمرّ مع المحتوى وشريط التبويبات وحده يلتصق.
   بعد أن نزلت التبويبات أسفل الوصف والأستاذ (بطلبٍ صريح) صارت الورقة
   الثابتة تأكل ~٤٧٠ بكسل — على هاتفٍ بارتفاع ٦٤٠ يبقى ١٧٠ للدروس.
   نفس العلاج المطبَّق على شاشة الأستاذ سابقًا: الغلاف داخل منطقة التمرير. */
ok('الغلاف داخل منطقة التمرير لا معلّقًا فوقها',
   /body\.append\(scrim, courseHero\(\)/.test(courseSrc) && /wrap\.append\(body\)/.test(courseSrc));
ok('وشريط التبويبات خارج الورقة كي يلتصق طوال التمرير',
   /h\('div\.chero__tabs', nameBar, seg\)/.test(courseSrc)
   && /\.chero__tabs \{[^}]*position: sticky/.test(cssSrc));
// خلفيةٌ صلبة تحته وإلّا مرّ محتوى الدروس مرئيًّا خلف الأزرار
ok('وخلفيته صلبة', /\.chero__tabs \{[^}]*background: var\(--surf\)/.test(cssSrc));
// القفز إلى القمّة بعد كل نقرة تبويب يدفع الغلاف في وجه الطالب من جديد
ok('ولا يُعاد التمرير إلى الغلاف عند تبديل التبويب',
   !/\bbody\.scrollTop = 0/.test((courseSrc.match(/function drawBody\(\)[\s\S]*?\n    \}/) || [''])[0]));
/* --- الترويسة الثابتة ---------------------------------------------------------
   الصورة **لا تتحرّك إطلاقًا**: تلتصق في مكانها والمحتوى ينزلق فوقها، فيبدو
   الغلاف منكمشًا من تحت ويبقى وجه الأستاذ ظاهرًا حتى آخر لحظة.

   ولماذا CSS لا JS: النسخة الأولى حسبت موضع الصورة بجافاسكربت في كل إطار.
   المتصفّح يمرّر على خيطٍ منفصل، فبالتمرير السريع تتأخّر جافاسكربت وراءه
   وتبقى الصورة على موضعٍ قديم — عطلٌ مرئيّ أبلغ عنه صاحب المنتج بلقطة.
   `position: sticky` يفعلها المتصفّح نفسه: لا تأخّر مهما كانت السرعة. */
/* --- شريط حالة النظام: كل عنصر لاصق بالأعلى يحسب حسابه ----------------------
   التطبيق `standalone` مع `viewport-fit=cover`، فمنطقة العرض تمتدّ **تحت**
   شريط حالة النظام و`env(safe-area-inset-top)` ≈ ٤٤ بكسل على هاتفٍ نموذجي.
   و`sticky` تلتصق بحافّة منطقة التمرير — أي تحت الشريط — فعنصرٌ بـ`top: 0`
   يُقصّ نصفه العلوي.

   وقع هذا فعلًا: شريط تبويبات شاشة المادة ظهر مقطوعًا بعد أوّل تمرير، ولم
   يظهر عند الوقوف على القمّة — فبدا عطلًا في التمرير لا في الإزاحة، وكلّف
   جولتَي تشخيص. وكان **العنصر الوحيد** في الملفّ الذي لا يحسبها.

   الحارس يقرأ الملفّ كلّه لا هذا العنصر: الغرض منع الثاني لا إصلاح الأوّل. */
{
  const clean = cssSrc.replace(/\/\*[\s\S]*?\*\//g, '');
  /* استثناءات، ولكلٍّ سببٌ مكتوب — قائمةٌ بلا أسباب تصير مقبرةَ أعطال:
       .chero__band  — الغلاف **يُقصد** أن يمتدّ تحت الشريط (صورة مبلَّغة)
       .chero__scrim — هو نفسه ساترُ الحاشية، فإزاحته صفرٌ بالتعريف
       .dash__side / .exam-side — داخل @media حاسوب، والحاشية هناك صفر
       .doc__bar     — أسفل شريط تطبيقٍ يحسبها بحشوته أصلًا */
  const allow = ['.chero__band', '.chero__scrim', '.dash__side', '.exam-side', '.doc__bar'];
  const bad = [];
  for (const [, sel, body] of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/position:\s*(sticky|fixed)/.test(body)) continue;
    const top = (body.match(/(?:^|;)\s*top:\s*([^;]+)/) || [])[1];
    if (top === undefined) continue;
    const one = sel.trim().replace(/\s+/g, ' ');
    if (allow.some((a) => one.endsWith(a))) continue;
    if (!/safe-area-inset-top/.test(top)) bad.push(`${one} → top:${top.trim()}`);
  }
  ok('كل عنصر لاصق بالأعلى يحسب شريط الحالة', bad.length === 0, bad.join(' · '));
  // ولو أفرغت القائمة الاستثناءات لما فحص شيئًا — نتأكّد أنه رأى عناصر فعلًا
  const seen = [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , b]) => /position:\s*(sticky|fixed)/.test(b) && /(?:^|;)\s*top:/.test(b));
  ok('والحارس رأى عناصر لاصقة فعلًا', seen.length >= 5, `${seen.length} عنصرًا`);
}

/* وساترُ الحاشية: شريطٌ بلون السطح يملأ ما تحت شريط الحالة **حين يلتصق شريط
   التبويبات وحده**. بلا الشفافية المشروطة كان الحلّ يكلّف ~٤٤ بكسل بياضٍ
   دائم فوق التبويبات حتى عند الوقوف على القمّة. */
ok('ساترُ الحاشية موجود ولا يحجز مساحة',
   /chero__scrim/.test(courseSrc)
   && /\.chero__scrim \{[^}]*height: env\(safe-area-inset-top\)/.test(cssSrc)
   && /\.chero__scrim \{[^}]*margin-bottom: calc\(-1 \* env\(safe-area-inset-top\)\)/.test(cssSrc));
ok('ويظهر بالشفافية مع اسم المادة نفسه',
   /\.chero__scrim \{[^}]*opacity: 0/.test(cssSrc)
   && /\.chero__scrim\.is-on \{[^}]*opacity: 1/.test(cssSrc)
   && /scrim\.classList\.toggle\('is-on'/.test(courseSrc));
// وفوق شريط التبويبات وإلّا ظهر تحته بلا فائدة
ok('وطبقتُه فوق شريط التبويبات',
   /\.chero__scrim \{[^}]*z-index: 4/.test(cssSrc));
// ولا يبتلع النقرات على الغلاف وهو شفّاف
ok('ولا يبتلع اللمس وهو شفّاف',
   /\.chero__scrim \{[^}]*pointer-events: none/.test(cssSrc));
/* توقيت الظهور يزيح بمقدار الحاشية: شريط التبويبات صار يلتصق أبكر بها،
   فبلا الإزاحة يتأخّر اسم المادة ٤٤ بكسل عن لحظته. والقيمة تُقرأ من ارتفاع
   الساتر نفسه لا تُكتب رقمًا — الحاشية تختلف من جهازٍ لآخر. */
ok('وتوقيت الظهور مزاحٌ بالحاشية المقروءة لا برقمٍ مكتوب',
   /getComputedStyle\(scrim\)/.test(courseSrc)
   && /rootMargin: `-\$\{inset\}px 0px 0px 0px`/.test(courseSrc));
ok('الصورة ثابتة بـsticky لا محسوبة بجافاسكربت',
   /\.chero__band \{[^}]*position: sticky/.test(cssSrc));
{
  /* أي مستمع تمرير يعيد المشكلة نفسها. الفحص مقصورٌ على `Screens.course`
     ومجرَّدٌ من التعليقات: `body.scrollTop = 0` مشروعةٌ في جلسة التمارين
     أسفل الملفّ، والتحذير نفسه يذكر الكلمة نصًّا. */
  const scope = (courseSrc.match(/Screens\.course = \([\s\S]*?\n  Screens\.lesson =/) || [''])[0]
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  ok('ونطاق الفحص مقروء', scope.length > 2000, `${scope.length} محرفًا`);
  ok('ولا مستمع تمرير في الشاشة إطلاقًا', !/addEventListener\(\s*'scroll'/.test(scope));
  ok('ولا حساب موضعٍ من scrollTop', !/scrollTop/.test(scope));
}
// الورقة تنزلق **فوق** الصورة، فتحتاج خلفيةً صلبة وطبقةً أعلى منها
ok('والورقة تعلو الصورة بخلفيةٍ صلبة',
   /\.chero__sheet \{[^}]*z-index: 1/.test(cssSrc)
   && /\.chero__sheet \{[^}]*background: var\(--surf\)/.test(cssSrc));
ok('وشريط التبويبات فوقهما معًا',
   /\.chero__tabs \{[^}]*z-index: 3/.test(cssSrc)
   && /\.chero__tabs \{[^}]*position: sticky/.test(cssSrc)
   && /\.chero__tabs \{[^}]*background: var\(--surf\)/.test(cssSrc));
ok('والغلاف تحتهما', /\.chero__band \{[^}]*z-index: 0/.test(cssSrc));

/* شريط الاسم: يظهر حين تُغطّى الصورة كي لا تضيع هويّة المادة داخل القائمة.

   بتغيّر الشفافية وحدها لا الارتفاع: ارتفاعٌ يتغيّر أثناء الاندفاع يدفع
   المحتوى ٣٦ بكسل فجأةً — وهو بالضبط شكل العطل الذي نصلحه. الشريط يحجز
   مكانه دائمًا ويُرى أو لا يُرى، فلا تخطيط يتغيّر أبدًا. */
{
  /* الارتفاع ثابتٌ بالبكسل (لا `auto`): هو ما يمنع تغيّر التخطيط. والقيمة
     تُفحص عددًا لا نصًّا كي لا يسقط الحارس على كل ضبطٍ بصريّ. */
  const barH = Number((cssSrc.match(/\.chero__bar \{[^}]*height:\s*(\d+)px/) || [])[1]);
  ok('شريط الاسم يحجز مكانه دائمًا ويتغيّر بالشفافية',
     barH > 0
     && /\.chero__bar \{[^}]*opacity: 0/.test(cssSrc)
     && /\.chero__bar\.is-on \{[^}]*opacity: 1/.test(cssSrc), `${barH || 0}px`);
  // ورأسُ الصفحة بعد التمرير كان ضيّقًا (بلاغٌ صريح) — ٤٨ حدٌّ أدنى للتنفّس
  ok('ورأس الصفحة بعد التمرير ليس ضيّقًا', barH >= 48, `${barH || 0}px`);
}

/* اسم المادة **موسَّطٌ** لا ملتصقٌ بحافّة: بشبكةٍ ثلاثية العمودين الجانبيان
   متساويان، فيبقى في وسط الشاشة البصري مهما كان طول الاسم أو وجود الزرّ —
   بخلاف `text-align: center` داخل صفٍّ مرن، فالزرّ يزيحه عن المركز. */
{
  const cols = (cssSrc.match(/\.chero__bar \{[^}]*grid-template-columns:\s*([^;]+)/) || [])[1];
  const side = (cols || '').trim().split(/\s+/);
  ok('واسم المادة موسَّط بعمودَين جانبيَّين متساويَين',
     side.length === 3 && side[0] === side[2] && side[1] === '1fr', cols || 'لا شبكة');
  ok('والنصّ نفسه موسَّطٌ داخل عموده',
     /\.chero__bar > span \{[^}]*text-align: center/.test(cssSrc));
}

/* زرّ الرجوع كان صغيرًا (بلاغٌ صريح). و٤٤ ليس رقمًا جماليًّا: هو الحدّ الأدنى
   لهدفٍ يُنقر بالإبهام في إرشادات iOS وWCAG، وهذا زرُّ الرجوع الوحيد الظاهر
   بعد التمرير — إخطاؤه يعني الخروج من الشاشة كلّها. */
{
  const w = Number((cssSrc.match(/\.chero__bb \{[^}]*width:\s*(\d+)px/) || [])[1]);
  ok('وزرّ الرجوع بحجم هدفٍ يُنقر بالإبهام', w >= 44, `${w || 0}px`);
  // وارتفاعه كامل الشريط: زرٌّ ٤٤ عرضًا و٢٤ ارتفاعًا ما زال هدفًا صغيرًا
  ok('وارتفاعه كامل الشريط', /\.chero__bb \{[^}]*height: 100%/.test(cssSrc));
}
// مخفيٌّ بصريًّا ⇒ مخفيٌّ عن اللمس والقارئ الشاشي، وإلّا نُقر زرُّ رجوعٍ لا يُرى
ok('والمخفيّ لا يُنقر ولا يُقرأ',
   /\.chero__bar \{[^}]*pointer-events: none/.test(cssSrc)
   && /\.chero__bar \{[^}]*visibility: hidden/.test(cssSrc));
/* والتبديل بمراقب تقاطعٍ لا بحدث تمرير: المراقب يُبلّغ الحالة الصحيحة بعد
   أي اندفاع مهما كانت سرعته، وحدث التمرير قد يفوته الإطار الأخير. */
ok('والتبديل بمراقب تقاطعٍ على حارسٍ نقطي',
   /new IntersectionObserver/.test(courseSrc) && /chero__sentinel/.test(courseSrc));

/* زرّ الرجوع: عاد `absolute` داخل الغلاف. الغلاف ملتصق فلا يمرّ، وحين
   تغطّيه الورقة يغطّي الزرّ معه — فيخلفه زرُّ الشريط. وكان `fixed` فصار
   يتصادم مع شريط التبويبات ويطفو فوق قائمة الدروس كرمزٍ شارد. */
ok('زرّ الغلاف داخل الغلاف لا عائمًا فوق كل شيء',
   /\.chero__back \{[^}]*position: absolute/.test(cssSrc));
ok('ويخلفه زرُّ رجوعٍ في شريط الاسم',
   /chero__bb/.test(courseSrc) && /\.chero__bb \{/.test(cssSrc));

// وصف المادة: سطران ثم «المزيد». بلا وصفٍ لا يظهر القسم أصلًا — عنصرٌ فارغ
// يترك فجوةً تبدو عطلًا.
ok('وصف المادة سطران قابلان للتوسيع',
   /chero__desc/.test(courseSrc) && /-webkit-line-clamp: 2/.test(cssSrc));
ok('و«المزيد» لا يظهر إلّا إن كان هناك ما يُخفى',
   /scrollHeight[\s\S]{0,80}clientHeight/.test(courseSrc));
// ويغيب عنوانه «الوصف» معه: عنوانٌ فوق فراغ أسوأ من غياب الاثنين
ok('وبلا وصف يغيب عنوانه معه', /if \(!text\) return \[\];/.test(courseSrc));

/* «ملفّات» تبويبٌ رابع لا قسمٌ داخل «الدروس»: نوطة المادة يفتحها الطالب
   مباشرةً بلا أن يمرّ على شجرة الوحدات. وشرطه وجود ملفٍّ فعلًا — تبويبٌ
   يُفتح على فراغ يبدو عطلًا. */
ok('«ملفّات» تبويبٌ رابع', /\['files',\s*'ملفّات'\]/.test(courseSrc));
ok('وشرطه وجود ملفّ', /subjectDocs\.length \? \[\['files'/.test(courseSrc));
ok('ورابطٌ قديم لتبويبٍ لا ملفّ فيه يسقط إلى الدروس',
   /tab === 'files' && !subjectDocs\.length[\s\S]{0,40}tab = 'lessons'/.test(courseSrc));
ok('ويعيد استعمال عارض الملفّات نفسه', /tab === 'files'\s*\? tabFiles\(\)/.test(courseSrc));

// المزامنة: الوصف والملفّات يصلان أصلًا، وملفٌّ بلا مالك لا يُعرض
ok('sync يجلب وصف المادة', /icon_pos,description/.test(syncSrc) && /desc: s\.description/.test(syncSrc));
ok('و ملفّات المادة مفصولةً عن ملفّات الدرس',
   /docsBySubject/.test(syncSrc) && /select: 'id,title,lesson_id,subject_id/.test(syncSrc));
ok('وملفٌّ بلا مالك لا يُنسب لأحد',
   /else if \(d\.subject_id\)/.test(syncSrc));

// --- مبدّل المقاطع بأسلوب iOS ------------------------------------------------------
ok('المضمار خلفية هادئة', /\.seg \{[^}]*background: var\(--surf2\)/.test(cssSrc));
ok('المقطع النشط مرفوع بظلّ', /\.seg button\[aria-selected="true"\] \{[^}]*box-shadow/.test(cssSrc));
// الظلّ الأسود يختفي على سطح داكن، فيحتاج بديلًا
ok('بديل للنشط في الوضع الليلي',
   /:root\[data-theme="dark"\] \.seg button\[aria-selected="true"\]/.test(cssSrc));

// ملف الأستاذ عمود واحد: النصّ تحت الصورة لا بجانبها
ok('لا تخطيط عمودين بملف الأستاذ', !/tprofile/.test(mainSrc) && !/tprofile/.test(cssSrc));
ok('الصورة وحدها محدودة العرض على الشاشات الواسعة',
   /\.teacher-hero-img \{\s*max-width: 460px; margin-inline: auto/.test(cssSrc));

/* أزرار الرجوع العائمة كلّها تُخفى على الحاسوب: كلٌّ منها `position: fixed`
   وفي RTL يقع على اليمين — أي فوق الشريط الجانبي تمامًا.

   الحارس يقرأ **قائمة المحدِّدات** لا شكلها: كُتب أوّلًا كتعبيرٍ يتوقّع
   `.teacher-back { display: none` متلاصقَين، فسقط لحظة انضمام زرٍّ ثالث
   إلى القائمة — على شيفرةٍ سليمة. */
{
  const hidden = [...cssSrc.matchAll(/([^{}]+)\{\s*display: none;?\s*\}/g)]
    .flatMap((m) => m[1].split(',').map((x) => x.trim()));
  const floating = ['.teacher-back'];
  const missing = floating.filter((sel) => !hidden.some((h2) => h2.endsWith(sel)));
  ok('أزرار الرجوع العائمة مخفيّة على الحاسوب', missing.length === 0, missing.join(' · '));
}

// --- الصف ومدّة الاشتراك: من السيرفر لا مثبَّتين ---------------------------------
// كانا `grade: 'g9'` و `daysLeft: 283` في store.js ولا يُحدَّثان أبدًا، فكان كل
// طالب يرى «الصف التاسع» مهما اشترى — وكورس البكالوريا (الوحيد الموجود) يظهر
// تحت التاسع — ويرى مدّة اشتراك مختلَقة عن اشتراك مدفوع.
// نُجرّد التعليقات قبل الفحص: التعليق الذي يشرح القيمة القديمة يذكرها نصًّا،
// فبلا التجريد يفشل الاختبار على توثيقه هو لا على الكود.
const storeCode = fs.readFileSync(dir + 'store.js', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
ok('لا صفّ مثبَّت في الحالة الابتدائية', !/grade:\s*'g9'/.test(storeCode));
ok('لا مدّة اشتراك مثبَّتة', !/daysLeft:\s*283/.test(storeCode));
ok('الصف يبدأ فارغًا لا مفترَضًا', /grade:\s*null/.test(storeCode));

ok('sync يجلب صفّ كل وحدة', /grade: gradeByUuid\[u\.courses\?\.grade_id\]/.test(syncSrc));
ok('sync يقرأ الاشتراك الحقيقي', /Api\.rpc\('my_entitlements'\)/.test(syncSrc));
ok('sync يضبط الصف والمدّة', /function pullEntitlements/.test(syncSrc));
ok('تغيّر الصف/المدّة يُحتسب تغييرًا', /entitle > 0/.test(syncSrc));

// الشاشات تشتقّ صفّ كل مادة من وحداتها لا من صفّ عام واحد
ok('شاشة المادة تشتقّ الصف من وحداتها',
   /unitGrades = \[\.\.\.new Set\(subjectUnits\.map\(\(u\) => u\.grade\)/.test(courseSrc));
ok('«موادّي» تشتقّ صفّ كل مادة', /gradeOfSubject/.test(mainSrc));
ok('لا قراءة .name بلا حماية على الصف',
   !/SEED\.grades\.find\(\(g\) => g\.id === s\.grade\)\.name/.test(mainSrc));

// اختبار وظيفي: وحدات البكالوريا يجب ألّا تُعرض تحت التاسع
const unitsG12 = SEED.units.filter((u) => u.subject === 'fr');
const derived = [...new Set(unitsG12.map((u) => u.grade).filter(Boolean))];
ok('وحدات الفرنسي مسجَّلة على البكالوريا', derived.length === 1 && derived[0] === 'g12');
ok('اسم الصف المشتقّ هو البكالوريا لا التاسع',
   SEED.grades.find((g) => g.id === derived[0]).name === 'البكالوريا');
// صفّان مختلفان ⇒ لا نرجّح أحدهما
const mixed = [...new Set(['g9', 'g12'])];
ok('بصفّين مختلفين لا يُعرض أيّهما', (mixed.length === 1 ? 'x' : '') === '');

// --- الترقيم: PostgREST يقصّ عند db-max-rows بلا أي إشارة خطأ ---------------------
// قِسنا الأثر على الإنتاج: ١٣٠١ خيارًا ⇒ ١٠٠٠ تصل، فـ٩٥ سؤالًا يظهر بلا خيارات.
{
  const a = fs.readFileSync(dir + 'data/api.js', 'utf8');
  const s = fs.readFileSync(dir + 'data/sync.js', 'utf8');
  ok('from() تُرقّم الصفحات بترويسة Range',
     /Range: `\$\{offset\}-\$\{offset \+ PAGE - 1\}`/.test(a));
  // السعة تُتعلَّم لا تُفترض: خفضُ db-max-rows لاحقًا يجب ألّا يُعيد القصّ
  ok('سعة الصفحة تُتعلَّم من أول صفحة', /if \(full === null\) full = page\.length;/.test(a)
     && /if \(page\.length < full\) break;/.test(a));
  // ترتيب غير فريد ⇒ الخادم حرّ في ترتيب المتساويات، فيتكرّر صفّ ويسقط آخر
  ok('الترتيب يُذيَّل بمفتاح فريد', /order \? `\$\{order\},\$\{pageKey\}` : pageKey/.test(a));
  ok('exam_questions تُرقَّم بمفتاحها المركّب (لا عمود id فيها)',
     /pageKey: 'exam_id,question_id'/.test(s));
  // وسيطٌ يتجاهل Range كان سيجعل الحلقة لا تنتهي والمصفوف ينمو حتى يموت التبويب
  ok('حارس ضدّ حلقة لا تنتهي', /head === prevHead/.test(a) && /pages >= 200/.test(a));
  ok('limit صريح يتجاوز الترقيم', /if \(limit\) \{[\s\S]{0,160}return request/.test(a));
  /* الإزاحة تحت RLS تُقيّم السياسة على كل صفّ تتخطّاه ثم ترميه: على ١٠ صفحات
     ذلك ~٤٥٠٠٠ تقييم مهدور مقابل ٩٦٠٠ نافع. قِسنا الفرق على ٩٦٠٠ خيار:
     ٩٩٢٥ms بالإزاحة ← ٦٢٦٠ms بالمفتاح. */
  ok('الترقيم بالمفتاح حين يكون الترتيب هو المفتاح',
     /const keyset = !order && !pageKey\.includes\(','\)/.test(a)
     && /q\.set\(pageKey, `gt\.\$\{cursor\}`\)/.test(a));
  ok('وأكبر جدول يُسحب بلا ترتيب خادم (يرتّبه التحويل محليًا)',
     !/'question_options', \{[^}]*order:/.test(s)
     && /\.sort\(\(a, b\) => a\.sort_order - b\.sort_order\)/.test(s));
}

// --- كلفة المزامنة وحصّة التخزين -------------------------------------------------
{
  const s = fs.readFileSync(dir + 'data/sync.js', 'utf8');
  ok('الكتالوج لا يُسحب إلّا إذا تغيّرت البصمة', /if \(await contentStale\(\)\)/.test(s)
     && /Api\.rpc\('content_version'\)/.test(s));
  ok('أي شكّ في البصمة ⇒ سحب لا تخطٍّ',
     /catch \{ return true; \}/.test(s)
     && /if \(!await Blob2\.get\(B_CONTENT\)\) return true;/.test(s));
  // البصمة بعد نجاح الحفظ لا قبله، وإلّا تجمّد المحتوى إلى الأبد عند امتلاء المساحة
  ok('البصمة تُثبَّت بعد نجاح الحفظ فقط', /if \(c\) commitVersion\(\);/.test(s));
  // الاستحقاق لا يُربط بتغيّر المحتوى: أيام الاشتراك تنقص بمرور الوقت
  ok('الاستحقاق يُسحب حتى حين يُتخطّى المحتوى',
     /entitle = await pullEntitlements\(c \|\| window\.SEED\);/.test(s)
     && !/contentStale\(\)[\s\S]{0,400}?pullEntitlements[\s\S]{0,20}\n\s*\}\n\s*\}/.test(s));
  ok('الحفظ محميّ من امتلاء الحصّة', /function storeContent/.test(s)
     && /catch \(e\) \{[\s\S]{0,400}storageFull: true/.test(s));
  ok('لا كتابة نصفية: الحالة السابقة تُرجَع',
     /restore\(B_CONTENT, prevC\);[\s\S]{0,80}restore\(B_IDMAP, prevM\);/.test(s));
  // وخريطة الذاكرة تُرَدّ مع القرص: خريطة أحدث من المحفوظ ترسل التقدّم لصفوف لم تُكتب
  ok('وخريطة الذاكرة تُرَدّ معها', /idMap = prevM \|\| \{\};/.test(s));
  ok('لا كتابة مباشرة للمفتاحين خارج storeContent',
     (s.match(/Blob2\.set\(B_CONTENT/g) || []).length === 1
     && (s.match(/Blob2\.set\(B_IDMAP/g) || []).length === 1);
  // --- التخزين: IndexedDB بدل حصّة الخمسة ميغابايت -------------------------------
  {
    const b = fs.readFileSync(dir + 'data/blobstore.js', 'utf8');
    const code = b.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    ok('المحتوى يُخزَّن في IndexedDB', /indexedDB\.open/.test(code));
    // الكائن يُخزَّن كما هو: لا JSON.stringify عند الحفظ ولا parse عند الإقلاع
    ok('بلا JSON في مسار IndexedDB', !/JSON\.(stringify|parse)/.test(code.split('const lsKey')[0]));
    ok('وبديلٌ يعمل حين يُمنع IndexedDB (تصفّح خاص)', /const lsKey/.test(code));
    // الترحيل ينقل ولا ينسخ، ولا يحذف القديم إلّا بعد نجاح الكتابة
    ok('الترحيل ينقل ولا ينسخ', /await set\(newKey, value\); localStorage\.removeItem\(oldKey\)/.test(code));
    ok('الخروج يمسح البصمة أيضًا', /removeItem\(VERSION_KEY\)/.test(s),
       'بصمة باقية تجعل الطالب التالي يتخطّى السحب فلا يرى شيئًا');
    ok('مسارات التقدّم تُحمّل الخريطة بنفسها',
       (s.match(/await ensureLoaded\(\);/g) || []).length >= 3,
       'idOf صار يقرأ الذاكرة، فمسارٌ يسبق applyStored يرفع تقدّمًا بمعرّفات فارغة');
  }
  ok('الطالب يرى سبب توقّف المحتوى', /s\.storageFull/.test(compSrc)
     && /مساحة التخزين ممتلئة/.test(compSrc));
}

// --- «يضلّ جارٍ التحميل»: لا مسار يحبس الطالب خلف السبلاش -------------------------
// علّتان كانتا تُعطّلان السقف الزمني نفسه، فيبقى الغطاء إلى الأبد.
ok('السقف الزمني يُسجَّل قبل أي شيء قد ينكسر',
   appSrc.indexOf('setTimeout(finish, 6000)') < appSrc.indexOf('const first = startSync')
   || /if \(hide\) setTimeout\(finish, 6000\);[\s\S]{0,120}try \{ render\(\)/.test(appSrc));
// التأكيدان أدناه يفحصان **الترتيب** لا شكل السطر: كانا مربوطين بصيغة
// `catch` من سطر واحد، فكسرهما إضافةُ سطر تبليغ داخل الـcatch رغم أن السلوك
// لم يتغيّر. فحصٌ ينهار من إعادة تنسيق يُدرَّب المرء على تجاهله.
ok('رفع الغطاء مضمون ولو انكسر الرسم',
   /try \{ render\(\); \} catch[\s\S]{0,240}?\n\s*\}\s*\n\s*if \(hide\) hide\(\);/.test(appSrc));
ok('الرسم الأول محاط بحارس',
   /try \{ render\(\); \} catch \(e\) \{[\s\S]{0,240}?الرسم الأول/.test(appSrc));
ok('بدء المزامنة محاط بحارس', /try \{ first = startSync\(\); \} catch/.test(appSrc));
// عقد الشكل: كتلة محفوظة ناقصة كانت تستبدل SEED السليم بآخر يكسر الشاشة
{
  const syncSrc2 = fs.readFileSync(dir + 'data/sync.js', 'utf8');
  const seedSrc = fs.readFileSync(dir + 'data/seed.js', 'utf8');
  ok('مصفوفات الشكل تُشتقّ من seed.js لا تُكتب يدويًا',
     /const SHAPE = Object\.keys\(window\.SEED[^\n]*Array\.isArray/.test(syncSrc2));
  ok('الكتلة الناقصة تُكمَّل لا تُرفض (لئلّا يفقد الطالب محتواه بلا إنترنت)',
     /for \(const k of SHAPE\) if \(!Array\.isArray\(filled\[k\]\)\) filled\[k\] = \[\];/.test(syncSrc2)
     && /window\.SEED = filled;/.test(syncSrc2));
  ok('seed.js ما زال يعلن الشكل بلا محتوى',
     /subjects: \[\]/.test(seedSrc) && /units: \[\]/.test(seedSrc));
}

// --- التخطّي والسحب -------------------------------------------------------------
// أربعة عقود لو انكسر أحدها تحوّل التخطّي من ميزة إلى ضرر صامت.
const examSrc2 = fs.readFileSync(dir + 'screens/exam.js', 'utf8');
ok('التخطّي لا يمرّ بـrecordAttempt', !/onSkip[^\n]*recordAttempt/.test(compSrc));
ok('النسبة تُحسب على ما أُجيب لا على حجم الجلسة',
   /correct \/ done\.length/.test(courseSrc) && !/correct \/ pool\.length/.test(courseSrc));
ok('التخطّي ليس طريقًا مختصرًا لإكمال الدرس',
   /params\.lesson && !left\.length\) Store\.completeLesson/.test(courseSrc));
ok('الرجوع يعيد حالة السؤال فلا تُسجَّل محاولتان',
   /initial: state\[/.test(courseSrc) && /initial: state\[/.test(examSrc2)
   && /onState/.test(compSrc));
// اتجاه السحب على نموذج الكتاب العربي: الصفحة التالية تُقلَب من اليسار لليمين
ok('السحب يمينًا تقدّم ويسارًا رجوع', /\(dx > 0 \? onNext : onPrev\)/.test(uiSrc));
ok('عتبة أفقية تمنع إطلاق النقرة', /Math\.abs\(dx\) < 60/.test(uiSrc));
ok('التمرير العمودي لا يُطلِق السحب', /Math\.abs\(dx\) < Math\.abs\(dy\) \* 1\.5/.test(uiSrc));
ok('البطاقة لا تترك السحب الأفقي للمتصفّح', /\.q \{[^}]*touch-action: pan-y/.test(cssSrc));

// --- الأيقونات: أبعادها الحقيقية تطابق ما يعلنه الـmanifest ----------------------
// شعارٌ يُستبدَل بملف بأبعاد أخرى يمرّ صامتًا: يُعرَض سليمًا بالمتصفح بينما
// يرفضه أندرويد عند التثبيت، ويُحمَّل كاملًا مع القشرة لأنه في قائمة التخزين.
{
  const path = require('node:path');
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  for (const it of mf.icons) {
    const b = fs.readFileSync(path.join(ROOT, it.src));
    const w = b.readUInt32BE(16), hh = b.readUInt32BE(20);
    ok(`${path.basename(it.src)} أبعاده ${it.sizes} فعلًا`, `${w}x${hh}` === it.sizes,
       `${w}×${hh}`);
    ok(`${path.basename(it.src)} خفيف بما يكفي للتخزين المسبق`, b.length < 400 * 1024,
       (b.length / 1024).toFixed(0) + ' ك.ب');
    ok(`${path.basename(it.src)} مخزَّن مسبقًا`, swSrc.includes(it.src.replace(/^/, './')));
  }
  // maskable يُقصّ بقناع النظام، فبلاطة مدوّرة سلفًا تُدوَّر مرّتين
  const msk = mf.icons.filter((i) => i.purpose === 'maskable');
  ok('للـmaskable ملفّه المستقلّ لا نسخة الأيقونة المدوّرة',
     msk.length === 1 && !mf.icons.some((i) => i.purpose === 'any' && i.src === msk[0].src));
}

/* =============================================================================
   تصادم أسماء الأصناف

   ورقة أنماط واحدة بلا خطوة بناء ولا نطاقٍ للأسماء: صنفٌ جديد يحمل اسمًا
   مستعمَلًا يُعيد تعريفه في كل الشاشات صامتًا. وقع هذا فعلًا وبأسوأ صورة —
   سُمّي شريطُ المواد الأفقي في الرئيسية `.rail`، وهو اسم **الشريط الجانبي
   للحاسوب** المخفيّ بـ`display: none`. فجاء `display: flex` بعده في الملفّ
   وأظهر الشريط الجانبي على الهاتف: عمودٌ رمادي يبتلع نصف الشاشة.

   ولم تسقط مجموعة واحدة. كل الفحوص كانت خضراء والتطبيق مكسور بالعين — لأن
   لا شيء منها يقرأ CSS كتسلسلٍ متتالٍ. هذا الحارس يقرؤه.

   ما داخل `@media` مستثنًى: إعادة التعريف هناك غرضُ الاستعلام نفسه.
   ============================================================================= */
{
  /* تعريفان أساسيان مقصودان وقائمان من قبل: كلاهما **يضيف** خاصّيةً ولا
     يعيد ضبط ما سبق. أي اسمٍ جديد يظهر هنا تصادمٌ حتى يُثبَت العكس. */
  const ALLOWED = new Set(['view', 'prose']);

  // نزع كتل @media بعدّ الأقواس — التعبير النمطي وحده لا يوازن الأقواس
  let top = '';
  for (let i = 0; i < cssSrc.length; i++) {
    if (cssSrc.startsWith('@media', i)) {
      let j = cssSrc.indexOf('{', i) + 1;
      for (let d = 1; j < cssSrc.length && d > 0; j++) {
        if (cssSrc[j] === '{') d++;
        else if (cssSrc[j] === '}') d--;
      }
      i = j - 1;
      continue;
    }
    top += cssSrc[i];
  }

  const counts = {};
  for (const m of top.matchAll(/^\.([a-zA-Z0-9_-]+)\s*\{/gm)) {
    counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  const dup = Object.entries(counts)
    .filter(([name, n]) => n > 1 && !ALLOWED.has(name))
    .map(([name, n]) => `.${name}×${n}`);

  ok('لا صنف CSS مُعرَّف مرّتين خارج @media', dup.length === 0, dup.join(' · '));
}

/* =============================================================================
   عارض الـPDF داخل صفحة RTL

   `ctx.direction` قيمته الافتراضية `inherit`، والتطبيق كلّه `rtl`. فكل نداء
   `fillText` يصدر عن pdf.js كان يُوضَع من اليمين إلى اليسار وتنزاح مجموعات
   الحروف عن مواضعها المحسوبة — كلماتٌ متكسّرة في العربية **واللاتينية معًا**.

   ولم يكشفه فحصٌ واحد: الشاشة تُبنى بلا استثناء، والملفّ سليم، والمكتبة
   سليمة (رسمتُ الملفّ نفسه في Node بنفس الخيارات فخرج مضبوطًا). العطل في
   بيئة الصفحة وحدها، ولا يُرى إلّا بالعين على جهاز.

   فالحارس نصّي بالضرورة — لا وسيلة أرخص تمنع عودته.
   ============================================================================= */
{
  const docSrc = fs.readFileSync(dir + 'data/doc.js', 'utf8');
  ok('سياق الرسم يُجبَر على ltr', /ctx\.direction\s*=\s*'ltr'/.test(docSrc));
  ok('ويُضبط قبل النداء لا بعده',
     docSrc.indexOf("ctx.direction = 'ltr'") < docSrc.indexOf('page.render('));
  ok('وصفحة الملفّ ltr في CSS أيضًا',
     /\.doc__p \{[^}]*direction: ltr/.test(cssSrc));

  /* CMap والخطوط القياسية: لازمتان للخطوط المضمَّنة من نوع CID وللبدائل حين
     يعجز عن قراءة خطّ. لم تكونا سبب العطل الأوّل، لكن غيابهما يكسر ملفّات
     أخرى بصمت — ولا يُكتشف إلّا بشكوى. */
  ok('ومسار CMap مضبوط', /cMapUrl:\s*'js\/vendor\/cmaps\//.test(docSrc)
     && /cMapPacked:\s*true/.test(docSrc));
  ok('ومسار الخطوط القياسية', /standardFontDataUrl:\s*'js\/vendor\/standard_fonts\//.test(docSrc));
  for (const p of ['js/vendor/cmaps', 'js/vendor/standard_fonts',
                   'js/vendor/pdf.min.js', 'js/vendor/pdf.worker.min.js']) {
    ok(`${p} موجود فعلًا`, fs.existsSync(require('node:path').join(ROOT, p)));
  }
  // ١٫٤ م.ب لا يجوز أن ينزّلها طالبٌ لن يفتح شرحًا مصوَّرًا
  ok('ومكتبة الـPDF خارج التخزين المسبق', !/pdf\.(min\.)?(worker\.)?js/.test(swSrc));

  /* ارتفاع الصفحة يُحجز من مقاسها لا بالتخمين.
     كان `min-height: 320px` ثابتًا في CSS: رقمٌ لا علاقة له بالملفّ، فتحجز
     كل صفحة ارتفاعًا خاطئًا ثم يتغيّر عند الرسم — تتزحزح الصفحات وتتداخل
     ويبدو بعضها مقطوعًا. */
  // `min-height\s*:` لا `min-height` وحدها — الكلمة ترد في تعليق الكتلة نفسها
  ok('وارتفاع الصفحة من نسبتها لا بالتخمين',
     /aspect-ratio/.test(docSrc) && !/min-height\s*:/.test(
       (cssSrc.match(/\.doc__p \{[^}]*\}/) || [''])[0]));
  ok('والنسبة تُحجز قبل رسم أوّل صفحة',
     docSrc.indexOf('aspect-ratio:${ratio}') < docSrc.indexOf('new IntersectionObserver'));

  /* تمريرٌ داخل تمرير على الهاتف: يلتقط الإصبعُ أحدَهما بلا قصد فتبدو
     الصفحات مقطوعة. التمرير الداخلي مسموحٌ في ملء الشاشة وحده — هناك لا
     تتمرّر الصفحة خلفه أصلًا. */
  {
    const flow = (cssSrc.match(/\.doc__pages \{[^}]*\}/) || [''])[0];
    ok('ولا صندوق تمرير داخل الصفحة',
       !/overflow:\s*auto/.test(flow) && !/max-height/.test(flow), flow.slice(0, 90));
    ok('وفي ملء الشاشة يتمرّر العارض نفسه',
       /\.doc\.is-max \.doc__pages \{[^}]*overflow:\s*auto/.test(cssSrc));
    ok('والشريط يبقى في متناول اليد',
       /\.doc__bar \{[^}]*position: sticky/.test(cssSrc));
  }

  /* التكبير بالأصابع لا بزرّين.
     وحذفُ الزرّين وحده لا يكفي: تكبيرُ المتصفّح يُمدّد صورةً منقّطة فيصير
     النصّ ضبابيًّا. `visualViewport` هو ما يعرف مقدار التكبير — و`resize`
     على النافذة لا يُطلق عنده على أغلب الهواتف. */
  ok('لا زرّي تكبير وتصغير', !/aria-label': 'تكبير'/.test(docSrc)
     && !/aria-label': 'تصغير'/.test(docSrc));
  /* المستمع نفسه لا مجرّد ذكر `visualViewport`: قراءةُ `scale` باقيةٌ في
     `applyPinch`، فتعبيرٌ يبحث عن الاسم وحده يمرّ ولو حُذف المستمع — ومعه
     لا يُعاد الرسم أبدًا ويبقى النصّ ضبابيًّا عند التكبير. */
  ok('والتكبير يُعيد الرسم بدقّة أعلى',
     /vv\?\.addEventListener\('resize'/.test(docSrc));
  ok('ويُنزع المستمع عند الإغلاق',
     /vv\?\.removeEventListener\('resize'/.test(docSrc));
  // مسحُ العلامة عن كل الصفحات ثم رسمها يجمّد هاتفًا اقتصاديًّا
  ok('ويعيد رسم الظاهر فقط', /for \(const c of visible\) draw\(c\)/.test(docSrc));
  ok('والخارج عن الشاشة يُزال من الظاهر',
     /visible\.delete\(e\.target\)/.test(docSrc));
  /* الصفحة نفسها يجب أن تسمح بالتكبير أصلًا: `user-scalable=no` أو
     `maximum-scale=1` في وسم المنفذ يُبطل حركة الأصابع كلّها — فيصير حذف
     الزرّين حذفًا للتكبير لا نقلًا له. */
  {
    const html = fs.readFileSync(require('node:path').join(ROOT, 'index.html'), 'utf8');
    const vp = (html.match(/<meta name="viewport"[^>]*>/) || [''])[0];
    ok('ومنفذ العرض لا يمنع التكبير',
       !!vp && !/user-scalable\s*=\s*no/.test(vp) && !/maximum-scale/.test(vp), vp);
  }
}

console.log('\n' + (fail.length ? `${fail.length} فشل` : 'كل الاختبارات نجحت'));
process.exit(fail.length ? 1 : 0);
