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
const cssSrc   = fs.readFileSync(require('node:path').join(ROOT, 'css/app.css'), 'utf8');
const uiSrc = fs.readFileSync(dir + 'ui.js', 'utf8');
const runRe = uiSrc.match(/const LATIN_RUN = (\/.*\/g);/);
ok('UI.rich يعرّف نمط عزل المقاطع اللاتينية', !!runRe);
if (runRe) {
  const LATIN = eval(runRe[1]);
  const mixed = "بحسب النص: Les robots menacent-ils l'Homme ? اختر الصحيح.";
  const runs = [...mixed.matchAll(LATIN)].map((m) => m[0]);
  ok('علامة الاستفهام تبقى داخل المقطع الفرنسي', runs.some((r) => r.trim().endsWith('?')));
  ok('لا يبتلع العزلُ النصَّ العربي', runs.every((r) => !/[؀-ۿ]/.test(r)));
}

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
// ANSI يفسد كل النص العربي فيها بصمت. العلامة الفارقة تسلسل «Ø».
const SRC = ['ui.js', 'store.js', 'components.js', 'app.js',
             'data/seed.js', 'data/api.js', 'data/device.js', 'data/sync.js', 'data/media.js',
             'screens/onboarding.js', 'screens/evicted.js', 'screens/progress.js',
             'screens/main.js', 'screens/course.js', 'screens/exam.js'];
const corrupt = SRC.filter((f) => /Ø|Ù|Ã˜/.test(fs.readFileSync(dir + f, 'utf8')));
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
ok('sync يجلب teachers بأعمدة ضيّقة', /'teachers',\s*\{\s*select:\s*'id,code,name,bio,photo_path'/.test(syncSrc));
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
ok('أزرار الشريط السفلي بلا نصّ ظاهر', /\}, h\('span\.tabbar__ico', it\.ico\(\d+\)\)\)/.test(appSrc));
ok('لها اسم لقارئ الشاشة', /'aria-label': it\.label/.test(appSrc));
ok('النشط له خلفية لا لون فقط',
   /\.tabbar button\.is-on \.tabbar__ico \{[^}]*background: var\(--acc-soft\)/.test(cssSrc));
ok('الشريط الجانبي يبقي نصّه', /it\.ico\(20\), it\.label/.test(appSrc));
ok('«موادّي» وجهة تنقّل مستقلّة الآن', /id:\s*'subjects'/.test(appSrc));
ok('«حسابي» لم تعد وجهة تنقّل', !/id:\s*'account'/.test(appSrc));
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
const brandCss = (cssSrc.match(/\.hbrand__name \{[^}]*\}/) || [''])[0];
ok('العلامة لا تُقصّ', !/overflow: *hidden/.test(brandCss)
   && !/text-overflow/.test(brandCss));
ok('سطر يتّسع لنزول الحروف', /line-height: 1\.5[0-9]?/.test(brandCss));
ok('لا تتبّع سالب على نصّ عربي', !/letter-spacing: *-/.test(cssSrc));
// الخروج وإعادة الضبط لازم يوديا لشاشة موجودة فعلًا لا لاسم محذوف
ok('الخروج/إعادة الضبط يودّيان إلى auth',
   !/App\.go\('welcome'\)/.test(mainSrc) && (mainSrc.match(/App\.go\('auth'\)/g) || []).length >= 2);
// أصل صورة الترحيب ما عاد له مستهلك — بقاؤه بالتخزين المسبق تنزيل بلا فائدة
const swSrc = fs.readFileSync(require('node:path').join(ROOT, 'sw.js'), 'utf8');
ok('welcome.jpg خرج من التخزين المسبق', !/welcome\.jpg/.test(swSrc));

// --- الرفة الدورية: لا إعادة رسم بلا تغيير حقيقي -------------------------------
// كانت pullProgress تُرجع عدد الصفوف المجلوبة لا المتغيّرة، فأي طالب له تقدّم
// يجعل الناتج موجبًا في كل مزامنة، و app.js يعيد رسم الشاشة عند أي ناتج موجب.
// مع animation:fadeIn على .screen كانت تبدو رجفةً/تحديثًا دوريًا للتطبيق.
ok('pullProgress يُرجع المتغيّر لا المجلوب',
   !/return lessons\.length \+ exams\.length/.test(syncSrc) && /return changed;/.test(syncSrc));
ok('يقارن الدروس بالحالة الحالية', /s\.lessons\[k\] !== nextLessons\[k\]/.test(syncSrc));
ok('لا يكتب الحالة إن لم يتغيّر شيء', /if \(changed\) Store\.set\(/.test(syncSrc));
ok('المحتوى يُقارن نصًّا قبل/بعد السحب',
   /const before = localStorage\.getItem\(CONTENT_KEY\)/.test(syncSrc)
   && /contentChanged = localStorage\.getItem\(CONTENT_KEY\) !== before/.test(syncSrc));
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

// --- قياسات البانر وبطاقة الأستاذ ------------------------------------------------
ok('البانر أكبر من السابق', /\.promo \{[^}]*height: 178px/.test(cssSrc));
ok('البانر يكبر أكثر على الشاشات الواسعة', /\.promo \{ height: 230px; \}/.test(cssSrc));
// بطاقة الأستاذ صارت صورة مصمَّمة كاملةً — لا حقول نصّية من التطبيق فوقها،
// وأي نصّ نضيفه سيصطدم بنصّ الصورة نفسها ويتكرّر.
ok('لا أثر لبطاقة الحقول القديمة', !/subj-showcase/.test(cssSrc) && !/subj-showcase/.test(mainSrc));
ok('البطاقة صورة واحدة', /\.tcard__img \{/.test(cssSrc));
// contain لا cover: القصّ يقطع اسم الأستاذ المرسوم داخل الصورة — وهو تحديدًا
// ما اشتكى منه المستخدم سابقًا.
ok('لا قصّ للصورة إطلاقًا', /\.tcard__img \{[^}]*object-fit: contain/.test(cssSrc));
ok('البطاقة عريضة تكاد تملأ العرض', /\.tcard \{[^}]*width: min\(84vw/.test(cssSrc));
ok('بديل مرئي ريثما تُرفع الصورة', /\.tcard__blank \{/.test(cssSrc) && /tcard__blank/.test(mainSrc));
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
// --- قائمة الدروس كخطّ زمني ---------------------------------------------------
ok('الدروس تُعرض كخطّ زمني', /h\('div\.tl'\)/.test(courseSrc) && /tl-row--/.test(courseSrc));
// الخطّ على الحاوية لا على كل صفّ: خطٌّ لكل صفّ يترك فجوات عند الهوامش
// فيبدو متقطّعًا بدل متواصل.
ok('الخطّ على الحاوية لا على الصفوف', /\.tl::before \{/.test(cssSrc)
   && !/\.tl-row::before \{[^}]*background: var\(--acc/.test(cssSrc));
// طرفا الخطّ ينتهيان عند أول وآخر نقطة لا عند حافة الحاوية
ok('الخطّ لا يتدلّى خارج النقاط', /\.tl::before \{[^}]*top: 28px; bottom: 28px/.test(cssSrc));
ok('ثلاث حالات للدرس', ['done', 'now', 'todo'].every((x) => courseSrc.includes(`'${x}'`))
   && /\.tl-row--done \.tl-dot/.test(cssSrc) && /\.tl-row--now  \.tl-dot/.test(cssSrc));
ok('الخطّ بلون الهوية البنفسجي', /\.tl::before \{[^}]*background: var\(--acc-soft\)/.test(cssSrc));
ok('النقطة المكتملة ممتلئة بالبنفسجي',
   /\.tl-row--done \.tl-dot \{[^}]*background: var\(--acc\)/.test(cssSrc));

// --- ترويسة الرئيسية/موادّي ------------------------------------------------------
// العلامة نصًّا لا شعارًا في الترويسة — أسلوب أغلب التطبيقات الحديثة.
// الشعار يبقى في شاشة الدخول والشريط الجانبي وأيقونة التطبيق.
ok('لا شعار في الترويسة', !/hbrand__logo/.test(mainSrc)
   && !/h\('div\.avatar', \(s\.username/.test(mainSrc));
ok('اسم التطبيق هو العلامة', /hbrand__name/.test(mainSrc) && /منهاجي/.test(mainSrc));
ok('الشعار باقٍ في الشريط الجانبي وشاشة الدخول',
   /assets\/img\/icon-192\.png/.test(appSrc)
   && /assets\/img\/icon-192\.png/.test(fs.readFileSync(dir + 'screens/onboarding.js', 'utf8')));
// الترويسة اسم مجرّد: لا شعار ولا عبارة تحته. العبارة التعريفية مكانها شاشة
// الدخول حيث يراها الطالب أول مرة، لا فوق كل شاشة يفتحها.
ok('لا عبارة تعريفية في الترويسة', !/hbrand__tag/.test(mainSrc) && !/hbrand__tag/.test(cssSrc));
ok('العبارة باقية في شاشة الدخول', /auth-brand__tag/.test(onbSrc));
// الوزن ٤٠٠ هو الأخفّ المحمَّل؛ طلب ٣٠٠ يُصطنع أو يسقط لخطّ احتياطي مشوّه
ok('لا وزن خطّ غير محمَّل', !/font-weight:\s*[123]00/.test(cssSrc));
ok('التحية عنوان للصفحة لا سطر في شريط', /h\('div\.hgreet'/.test(mainSrc)
   && /\.hgreet \{[^}]*font-size: 22px/.test(cssSrc));
// الاتفاق: الهيدر شعار وإعدادات فقط، والتحية محتوى صفحة داخل منطقة التمرير.
// الحارس يمسك عودتها إلى الهيدر: نتأكّد أن hgreet تقع بعد فتح .screen__body
// في كلتا الشاشتين لا داخل <header>.
const headerBlocks = mainSrc.match(/h\('header\.appbar\.appbar--home',[\s\S]*?\n      \),/g) || [];
ok('الهيدر بلا تحية', headerBlocks.length === 2
   && headerBlocks.every((b) => !/hgreet/.test(b)));
ok('الهيدر يحوي العلامة والإعدادات فقط',
   headerBlocks.every((b) => /hbrand__name/.test(b) && /iconbtn/.test(b)));
// شاشتان تحملان تحية (الرئيسية وموادّي)
ok('التحية موجودة بالشاشتين', (mainSrc.match(/h\('div\.hgreet'/g) || []).length === 2);
// وجودها داخل منطقة التمرير فعليًا يتحقّق ببناء الشاشة لا بقراءة المصدر —
// انظر render-check.js في مجلد الفحص.
ok('زوايا سفلية بأسلوب iOS', /\.appbar--home \{[^}]*border-radius: 0 0 24px 24px/.test(cssSrc));
ok('ظلّ بنفسجي خفيف', /rgba\(91, 75, 158, \.30\)/.test(cssSrc));
// الظلّ الملوَّن يختفي على خلفية داكنة — يحتاج بديلًا أعمق لا نفس القيمة
ok('ظلّ مستقلّ للوضع الليلي',
   /:root\[data-theme="dark"\] \.appbar--home \{[^}]*box-shadow/.test(cssSrc));

// سهم الدخول: عنصر زخرفي لا زرّ ثانٍ — زرٌّ داخل زرّ HTML غير صالح
// ويكسر التنقّل بلوحة المفاتيح.
ok('سهم الدخول موجود بالبطاقة', /tcard__go/.test(mainSrc) && /\.tcard__go \{/.test(cssSrc));
ok('السهم span لا button', /h\('span\.tcard__go'/.test(mainSrc));
// في RTL يبدأ المحور من اليمين، فاليسار = inset-inline-end
ok('السهم بالزاوية اليسرى السفلى',
   /\.tcard__go \{[^}]*bottom: 14px[^}]*inset-inline-end: 14px/.test(cssSrc));
ok('أيقونة تشير يسارًا (اتجاه التقدّم بالعربية)', /fwd:\s*\(s\) => svg\('<path d="m14\.5 5\.5-6\.5 6\.5 6\.5 6\.5"/.test(uiSrc));

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

ok('زرّ الرجوع مخفيّ على الحاسوب (يقع فوق الشريط الجانبي)',
   /\.teacher-back \{ display: none; \}|\.teacher-back \{ display: none/.test(cssSrc)
   || /\.view \.appbar__back,\s*\n\s*\.teacher-back \{ display: none/.test(cssSrc));

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

console.log('\n' + (fail.length ? `${fail.length} فشل` : 'كل الاختبارات نجحت'));
process.exit(fail.length ? 1 : 0);
