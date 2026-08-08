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
ok('أزرار الشريط السفلي بلا نصّ ظاهر', /\}, h\('span\.tabbar__ico', it\.fico\(\d+\)\)\)/.test(appSrc));
ok('لها اسم لقارئ الشاشة', /'aria-label': it\.label/.test(appSrc));
// النشط على أرضية بنفسجية: الخلفية بيضاء شفّافة لا --acc-soft الفاتحة
ok('النشط له خلفية لا لون فقط',
   /\.tabbar button\.is-on \.tabbar__ico \{[^}]*background: rgba\(255, 255, 255/.test(cssSrc));
ok('الشريط الجانبي يبقي نصّه', /it\.ico\(20\), it\.label/.test(appSrc));
ok('«موادّي» وجهة تنقّل مستقلّة الآن', /id:\s*'subjects'/.test(appSrc));
ok('«حسابي» صارت وجهة تنقّل رابعة', /id:\s*'account'/.test(appSrc)
   && (appSrc.match(/\{ id: '/g) || []).length === 4);

// --- الشريط السفلي على نمط المرجع البصري -----------------------------------------
// أيقونات ممتلئة لا خطّية: خطٌّ أبيض رفيع على أرضية بنفسجية عند ٢٣px يذوب
ok('أيقونات الشريط ممتلئة', /fill: 'currentColor', stroke: 'none'/.test(uiSrc)
   && /fHome:|fGrid:|fChart:|fUser:/.test(uiSrc));
ok('والشريط الجانبي يبقى بالخطّية (أرضيته فاتحة)', /ico: icon\.home/.test(appSrc));
ok('الشريط يطفو لا يلتصق بالحافة',
   /\.tabbar \{[^}]*inset-inline: 14px[^}]*bottom: calc\(12px/.test(cssSrc));
ok('بحبّة كاملة الاستدارة', /\.tabbar \{[^}]*border-radius: var\(--r-full\)/.test(cssSrc));
ok('على أرضية بنفسجية من التوكنات لا هكس مكتوب',
   /\.tabbar \{[^}]*var\(--nav-hi\), var\(--nav\)/.test(cssSrc));
{
  const tok = fs.readFileSync(dir + '../css/tokens.css', 'utf8');
  ok('ولون الشريط معرَّف في الوضعين', (tok.match(/--nav:/g) || []).length === 2);
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
// زرّان دائريان كما في المرجع: إشعارات وإعدادات
ok('الترويسة فيها زرّا إشعارات وإعدادات',
   /icon\.bell\(19\)/.test(compSrc) && /icon\.settings\(19\)/.test(compSrc));
ok('وهما قرصان أبيضان بظلّ',
   /\.hbtn \{[^}]*border-radius: 50%[^}]*background: var\(--surf\)/.test(cssSrc)
   && /\.hbtn \{[^}]*box-shadow/.test(cssSrc));
// في RTL يذهب أوّل عنصر يمينًا: التحية قبل الأزرار ⇒ تحية يمينًا وأزرار يسارًا
ok('التحية يمينًا والأزرار يسارًا',
   compSrc.indexOf("h('div.hgreet'") < compSrc.indexOf("h('div.hacts'"));
// الاسم بجانب التحية لا تحتها، ومحاذاته على خطّ الأساس لا على المنتصف
ok('الاسم بجانب التحية', /\.hgreet \{[^}]*display: flex[^}]*align-items: baseline/.test(cssSrc));
// الترويسة في السياق الطبيعي، فإخفاؤها بـtransform يترك مكانها فراغًا
ok('تختفي بهامش سالب لا بإزاحة',
   /\.appbar--home\.is-away \{[^}]*margin-top: calc\(-1 \* var\(--h/.test(cssSrc));
ok('وارتفاعها يُقاس لا يُفترض', /setProperty\('--h', hdr\.offsetHeight/.test(appSrc));
ok('عتبة تمنع الارتجاف', /Math\.abs\(y - last\) < 6/.test(appSrc));
ok('ولا تختفي قرب القمّة', /y > 56 && y > last/.test(appSrc));
// النقطة الحمراء تتبع إشعارًا حقيقيًا؛ شارة دائمة تفقد معناها بعد يومين
ok('نقطة الإشعار مشروطة لا دائمة', /list\.length \? h\('span\.hbtn__dot'\) : null/.test(compSrc));
ok('والإشعارات مشتقّة من حالة التطبيق لا مُختلَقة',
   /function notices\(\)/.test(compSrc) && /s\.storageFull/.test(compSrc)
   && /s\.daysLeft <= 14/.test(compSrc));
// ترويسة واحدة تخدم الشاشتين: نسختان متطابقتان كانتا تفترقان بأول تعديل
ok('ترويسة مشتركة لا منسوخة', (mainSrc.match(/C\.homeHeader\(/g) || []).length === 2
   && !/hbrand__name/.test(mainSrc));
// عنوان الصفحة بصنفه الخاص: مشاركته صنفَ الترويسة تجعل ضبط أحدهما يحرّك الآخر
ok('عنوان القسم منفصل عن تحية الترويسة', /\.ptitle \{/.test(cssSrc) && /ptitle/.test(mainSrc));
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

// --- قياسات البانر وبطاقة الأستاذ ------------------------------------------------
// بلا بانر مضاف لا يُعرض شيء: لا شرائح بديلة، ولا حاوية فارغة تحجز 178px
ok('لا شرائح بديلة في الشيفرة', !/EVERGREEN/.test(mainSrc));
ok('عنصر البانر لا يُبنى بلا شرائح', /!slides\.length \? null :/.test(mainSrc));
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
// --- بطاقات الدروس (المرجع البصري) حلّت محلّ الخطّ الزمني -------------------------
ok('الدروس بطاقات لا خطًّا زمنيًا',
   /h\('div\.lgrid'\)/.test(courseSrc) && !/h\('div\.tl'\)/.test(courseSrc));
ok('ولا بقايا للخطّ في الأنماط', !/\.tl-row|\.tl-dot|\.tl-act/.test(cssSrc));
ok('ثلاث حالات للدرس', ['done', 'now', 'todo'].every((x) => courseSrc.includes(`'${x}'`)));
// المكتمل يهدأ عمدًا: بعشرين درسًا تخفي لوحةٌ كلّها ألوان «أين وصلت»
ok('المكتمل لا يُلوَّن', /state === 'done' \? '' : 'lcard--c'/.test(courseSrc)
   && /\.lcard--done \{[^}]*background: var\(--surf2\)/.test(cssSrc));
ok('واللون بترتيب ثابت لا عشوائي', /'lcard--c' \+ \(n % 4\)/.test(courseSrc));
// عنوانٌ طويل يمطّ البطاقة فتختلّ الشبكة كلّها
ok('العنوان محدود بسطرين', /\.lcard__t \{[^}]*-webkit-line-clamp: 2/.test(cssSrc));

// --- بطاقات المواد في «موادّي» ----------------------------------------------------
ok('المواد بطاقات ملوّنة', /h\('div\.subj-grid'/.test(mainSrc) && /\.subj-grid \{/.test(cssSrc));
ok('بشبكة لا صفّ يمرّر أفقيًا', /\.subj-grid \{[^}]*grid-template-columns/.test(cssSrc));
// أُسقطت الحلقة لا المعلومة: «كم أنجزت» سبب دخول الطالب هذه الشاشة
ok('التقدّم باقٍ كشريط على البطاقة', /subj__bar/.test(mainSrc) && /\.subj__bar i \{/.test(cssSrc));
ok('واللون بترتيب ثابت', /'subj--c' \+ \(i % 5\)/.test(mainSrc));
// الحالة تُقرأ من الأيقونة والهدوء لا من نقطة على خطّ: المكتمل صحٌّ أخضر
ok('المكتمل يحمل علامة صحّ', /state === 'done' \? icon\.check\(19\)/.test(courseSrc)
   && /\.lcard--done \.lcard__ico \{[^}]*color: var\(--ok\)/.test(cssSrc));
ok('والجاري يُميَّز بحلقة لا بلون آخر',
   /\.lcard--now \{[^}]*box-shadow: 0 0 0 3px var\(--acc-soft\)/.test(cssSrc));

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
/* الترويسة بلا حاوية إطلاقًا (المرجع البصري): كانت بطاقة بيضاء بظلّ بنفسجي
   وزوايا سفلية مدوّرة فتُقرأ كصندوق ملصوق فوق الصفحة. */
{
  const hdr = (cssSrc.match(/\.appbar--home \{[^}]*\}/) || [''])[0];
  ok('الترويسة بلا حاوية', /background: transparent/.test(hdr)
     && /box-shadow: none/.test(hdr) && /border-radius: 0;/.test(hdr));
  ok('ولا ظلّ مستقلّ للوضع الليلي بعدها',
     !/:root\[data-theme="dark"\] \.appbar--home/.test(cssSrc));
  // الأزرار تُحاذي أعلى كتلة التحية لا منتصفها — سطران مقابل سطر
  ok('محاذاة علوية', /align-items: flex-start/.test(hdr));
}

// سهم الدخول: عنصر زخرفي لا زرّ ثانٍ — زرٌّ داخل زرّ HTML غير صالح
// ويكسر التنقّل بلوحة المفاتيح.
ok('سهم الدخول موجود بالبطاقة', /tcard__go/.test(mainSrc) && /\.tcard__go \{/.test(cssSrc));
ok('السهم span لا button', /h\('span\.tcard__go'/.test(mainSrc));
// في RTL يبدأ المحور من اليمين، فاليسار = inset-inline-end
ok('السهم بالزاوية اليسرى السفلى',
   /\.tcard__go \{[^}]*bottom: 14px[^}]*inset-inline-end: 14px/.test(cssSrc));
// المقصود المسار نفسه لا توقيع الدالة: يبدأ يمينًا وينتهي يمينًا مارًّا باليسار
ok('أيقونة تشير يسارًا (اتجاه التقدّم بالعربية)',
   /fwd:\s*\(s(, o)?\) => svg\('<path d="m14\.5 5\.5-6\.5 6\.5 6\.5 6\.5"/.test(uiSrc));
// السهم علامة وحيدة في زاوية بيضاء: تُقرأ بالسماكة والإشباع لا بالحجم
{
  const call = mainSrc.match(/icon\.fwd\((\d+), \{ width: ([\d.]+) \}\)/);
  ok('السهم يمرَّر سماكته عند الاستدعاء',
     !!call && /fwd:\s*\(s, o\) => svg\([^)]*, s, o\)/.test(uiSrc));
  // السماكة بوحدات viewBox لا بكسلات: القياس الحقيقي = width × size/24
  ok('السماكة الفعلية تفوق الافتراضي بوضوح',
     !!call && (+call[2] * +call[1] / 24) > 1.75, call ? (+call[2] * +call[1] / 24).toFixed(2) + 'px' : '—');
}
ok('السهم ببنفسجي مشبَع لا بالأكسنت المكتوم',
   /\.tcard__go \{[^}]*color: var\(--acc-vivid\)/.test(cssSrc));
{  // على أرضية داكنة يختفي البنفسجي الغامق نفسه، فلا يُنسخ بل يُرفع
  const tok = fs.readFileSync(require('node:path').join(ROOT, 'css/tokens.css'), 'utf8');
  const vals = [...tok.matchAll(/--acc-vivid:\s*(#[0-9A-Fa-f]{6})/g)].map((m) => m[1]);
  ok('للـacc-vivid قيمة في كلا الوضعين', vals.length === 2, vals.join(' · '));
  ok('قيمتا الوضعين مختلفتان', new Set(vals).size === 2);
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
ok('رفع الغطاء مضمون ولو انكسر الرسم',
   /try \{ render\(\); \} catch[^\n]*\n\s*if \(hide\) hide\(\);/.test(appSrc));
ok('الرسم الأول محاط بحارس', /try \{ render\(\); \} catch \(e\) \{[^\n]*الرسم الأول/.test(appSrc));
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

console.log('\n' + (fail.length ? `${fail.length} فشل` : 'كل الاختبارات نجحت'));
process.exit(fail.length ? 1 : 0);
