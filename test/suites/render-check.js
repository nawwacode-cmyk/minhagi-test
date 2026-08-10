// يتحقّق أن الشاشات الجديدة تُبنى فعلًا بلا استثناء، ويطبع HTML الناتج.
// ليس بديلًا عن الفحص البصري — يكشف أخطاء التشغيل فقط.
//
/* البيئة الوهمية كانت **منسوخةً حرفيًّا** هنا وفي `render-check-lib.js`.
   نسختان تنحرفان بصمت: إصلاحُ الواحدة لا يبلغ الأخرى، وقد وقع ذلك فعلًا —
   أُضيفت `exam.js` و`evicted.js` و`halted.js` و`plan.js` إلى المكتبة فبقيت
   هذه عمياء عنها، فكان `render-check` يمرّ وهو لا يرسم نصف الشاشات. */
const fs = require('fs');
const path = require('node:path');
const dir = path.join(__dirname, '..', '..', 'js') + '/';
require('./render-check-lib.js');

// صورة أستاذ حقيقية بالبطاقة لنرى القصّ من عدمه بالمعاينة  // صورة-أستاذ-حقيقية
window.SEED.teachers[0].photo = 'teachers/demo.jpg';
window.SEED.teachers[0].name = 'نوار بشناق';
window.SEED.banners = [
  { id:'b1', title:'اشتراك سنوي — كل المنهاج', sub:'دروس وتمارين وامتحانات وزارية', image:null, target:null },
  { id:'b2', title:'امتحانات وزارية محلولة', sub:'دورات سابقة بصيغة ورقة الفحص', image:null, target:null },
  // بصورة ووجهة مخصَّصة — لنرى بطاقة «آخر الأخبار» بصورتها وتعتيمها فعليًا
  { id:'b3', title:'دورة تقوية فرنسي — تسجيل مفتوح', sub:'مقاعد محدودة هذا الشهر',
    image: 'banners/promo1.jpg', target: { type: 'subject', value: 'fr' } },
];
Store.set({ signedIn: true, activated: true, username: 'أحمد', grade: 'g9', daysLeft: 283 });

const cases = [
  ['home', () => Screens.home()],
  ['subjects', () => Screens.subjects()],
  ['teacher (بنبذة)', () => Screens.teacher({ id: 'ustaz-sami' })],
  ['teacher (بلا نبذة ولا مواد)', () => Screens.teacher({ id: 'ustaz-rana' })],
  ['teacher (غير موجود)', () => Screens.teacher({ id: 'لا-أحد' })],
  ['course', () => Screens.course({ subject: 'fr' })],
  ['course (بتقدّم)', () => { Store.completeLesson('salutations'); Store.startLesson('articles-definis'); return Screens.course({ subject: 'fr' }); }],
  ['progress', () => Screens.progress()],
  /* درس فيه جدول: الجدول كان يفرض عرضه على عمود الشبكة فتخرج الصفحة كلّها
     عن الشاشة — ظهر الفيديو مقتطعًا والعنوان مبتورًا. */
  ['درس بجدول', () => Screens.lesson({ id: 'salutations', subject: 'fr' })],
  ['account', () => Screens.account()],
  ['آخر الأخبار', () => Screens.news()],
  ['آخر الأخبار — لا بانرات', () => { const full = window.SEED.banners; window.SEED.banners = [];
    const n = Screens.news(); window.SEED.banners = full; return n; }],
  ['auth', () => Screens.auth()],
  /* درسٌ شرحه PDF — الفرع الجديد. والفرع المقابل (بلا اتصال) يظهر رسالةً
     صريحة لا فراغًا: الشرح خلف رابطٍ موقّع فلا يعمل أوفلاين بعد. */
  ['درس بشرح PDF', () => { const l = window.SEED.lessons['salutations'];
    l.doc = 'doc-1'; l.mode = 'pdf';
    const n = Screens.lesson({ id: 'salutations', subject: 'fr' });
    delete l.doc; delete l.mode; return n; }],
  ['درس بشرح PDF (بلا اتصال)', () => { const l = window.SEED.lessons['salutations'];
    l.doc = 'doc-1'; l.mode = 'pdf'; Store.set({ online: false });
    const n = Screens.lesson({ id: 'salutations', subject: 'fr' });
    Store.set({ online: true }); delete l.doc; delete l.mode; return n; }],
  /* ملفٌّ مرفوع والوضع «نصّ»: المحرِّر يجهّز شرحًا ولمّا يقرّر عرضه بعد.
     يجب أن يرى الطالب النصّ لا الملفّ — وهذا هو الفرق بين قرارٍ صريح
     وقاعدةٍ ضمنية «إن وُجد ملفّ فهو الفائز». */
  ['درس بملفّ مرفوع لكن الوضع نصّ', () => { const l = window.SEED.lessons['salutations'];
    l.doc = 'doc-1'; l.mode = 'text';
    const n = Screens.lesson({ id: 'salutations', subject: 'fr' });
    delete l.doc; delete l.mode; return n; }],
  /* الوضع «pdf» بلا ملفّ — سهوٌ في اللوحة أو ملفٌّ حُذف. الطالب يرى النصّ
     لا شاشةً فارغة: لا يدفع ثمن خطأ إدخال. */
  ['درس وضعه pdf بلا ملفّ', () => { const l = window.SEED.lessons['salutations'];
    l.mode = 'pdf';
    const n = Screens.lesson({ id: 'salutations', subject: 'fr' });
    delete l.mode; return n; }],
  /* تنبيه الاشتراك **شرطيّ**، والتجهيزات فيها ٢٨٣ يومًا — فالفرع لا يُرسم
     أبدًا ما لم نضيّق المدّة هنا. فرعٌ لا يُرسم في أي فحص هو فرعٌ يُكتشف عطله
     على طالبٍ يوشك اشتراكه على الانتهاء، وهو أسوأ وقت لاكتشافه. */
  ['home (اشتراك يوشك)', () => { const d = Store.get().daysLeft;
    Store.set({ daysLeft: 9 }); const n = Screens.home(); Store.set({ daysLeft: d }); return n; }],
  ['خطّتي', () => Screens.plan()],
  ['خطّتي (اشتراك يوشك — وتيرة لا تكفي)', () => { const d = Store.get().daysLeft;
    Store.set({ daysLeft: 1 }); const n = Screens.plan(); Store.set({ daysLeft: d }); return n; }],
  ['خطّتي (بلا مواد)', () => { const subs = window.SEED.subjects;
    window.SEED.subjects = []; const n = Screens.plan(); window.SEED.subjects = subs; return n; }],
  ['خطّتي (المنهاج منتهٍ)', () => {
    // كل درس مُنجَز: البطاقة تتحوّل إلى تهنئة لا إلى فراغ
    const before = { ...Store.get().lessons };
    (window.SEED.units || []).forEach((u) => (u.lessons || []).forEach((id) => Store.completeLesson(id)));
    const n = Screens.plan(); Store.set({ lessons: before }); return n; }],
  ['جلسة تركيز', () => Screens.focus({ lesson: 'salutations', subject: 'fr' })],
  ['جلسة تركيز (درس محذوف)', () => Screens.focus({ lesson: 'لا-يوجد', subject: 'fr' })],
  ['teacher (بصورة)', () => { window.SEED.teachers[0].photo='teachers/x.png'; const n=Screens.teacher({id:'ustaz-sami'}); window.SEED.teachers[0].photo=null; return n; }],

  /* بطاقة سؤال بنصوص **حقيقية** خلطت اللغتين وكسرت العرض سابقًا. لم تكن
     المعاينة تعرض أي شاشة أسئلة إطلاقًا، ولهذا لم تُرَ هذه الأعطال فيها قطّ. */
  ['سؤال مختلط اللغتين', () => C.questionCard({
    id: 'demo-1', type: 'mcq', subject: 'fr',
    stem: 'ما معنى الكلمة الفرنسية التالية؟\n« inoubliable » (صفة)',
    why: '**inoubliable** = لا يُنسى — من مفردات الصالون الثقافي، الوحدة 3.',
    options: [{ k: 'أ', t: 'مشترك متبادل' }, { k: 'ب', t: 'لا يمكن تجنّبه' },
              { k: 'ج', t: 'لا يُنسى', correct: true }],
  }, { index: 4, total: 31, onNext() {}, onSkip() {} })],

  ['سؤال قواعد فرنسي', () => C.questionCard({
    id: 'demo-2', type: 'mcq', subject: 'fr',
    stem: 'الدورة الأولى ٢٠٢٢ (علمي) — Grammaire :\n'
        + '9- La municipalité a publié un calendrier ......... annoncer les événements sociaux.',
    why: 'الصواب **pour** — أداة الغرض قبل الفعل في صيغة المصدر.',
    options: [{ k: 'أ', t: 'pour', correct: true }, { k: 'ب', t: "de manière à ce qu'" },
              { k: 'ج', t: 'Pour que' }],
  }, { index: 0, total: 18, onNext() {}, onSkip() {} })],
];

let bad = 0;
const out = {};
for (const [name, fn] of cases) {
  try { const n = fn(); out[name] = n.outerHTML; console.log('ok   ' + name); }
  catch (e) { bad++; console.log('FAIL ' + name + ' → ' + e.message); }
}

// حالة حرجة: SEED فارغة تمامًا (قبل أول مزامنة / أول فتح بلا إنترنت)
const full = window.SEED;
window.SEED = { subjects: [], grades: [], units: [], lessons: {}, questions: {}, exams: [], teachers: [] };
for (const [name, fn] of [['home', Screens.home], ['subjects', Screens.subjects]]) {
  try { fn(); console.log('ok   ' + name + ' — SEED فارغة'); }
  catch (e) { bad++; console.log('FAIL ' + name + ' — SEED فارغة → ' + e.message); }
}
window.SEED = full;

/* أيقونة كل مادة: بطاقات «موادّي» صُمِّمت على هيئة كتب، وكانت كلّها تحمل
   أيقونة كتاب عامّة واحدة فلا يميّز الطالب مادّته من شكلها قبل قراءة الاسم.
   كل معرّف معروف الآن يرجع مسارًا مختلفًا، ومعرّفٌ مجهول يرجع لأيقونة الكتاب —
   لا يكسر بطاقة مادة تُضاف قبل أن تُرسَم لها أيقونة مخصَّصة. */
{
  const codes = ['fr', 'en', 'math', 'physics', 'chemistry', 'biology',
                  'history', 'geography', 'philosophy', 'religion', 'arabic', 'national_edu'];
  const paths = codes.map((c) => UI.subjectIcon(c, 20).outerHTML);
  const distinct = new Set(paths).size === paths.length;
  if (distinct) console.log('ok   كل مادة معروفة بأيقونة مختلفة');
  else { bad++; console.log('FAIL كل مادة معروفة بأيقونة مختلفة → أيقونتان متطابقتان على الأقل'); }

  const fallback = UI.subjectIcon('لا-معرّف-كهذا', 20).outerHTML === UI.icon.book(20).outerHTML;
  if (fallback) console.log('ok   معرّف مجهول يرجع لأيقونة الكتاب');
  else { bad++; console.log('FAIL معرّف مجهول يرجع لأيقونة الكتاب'); }
}

/* subjectIconEl: صورة WebP لما يملك أصلًا، وإلّا خطوط SVG. الأحياء بلا صورة
   معالَجة بعد (لم تصل الملفّات الخام) فيجب أن تقع على SVG لا أن تُظهر <img>
   بمسار غير موجود — عرضٌ مكسور صامت أسوأ من أيقونة مبسّطة. */
{
  const withImg = UI.subjectIconEl('fr', 20);
  ok2('مادة لها صورة ⇒ <img> بمسار WebP الصحيح',
      withImg.tagName === 'img' && withImg.attrs.src === 'assets/img/subjects/french.webp');

  const noImg = UI.subjectIconEl('biology', 20);
  ok2('مادة بلا صورة بعد ⇒ SVG لا <img> مكسور', noImg.tagName === 'svg');

  // كل معرّف بصورة مذكور فعليًا في SHELL — وإلّا غاب أوفلاين رغم أنه يعمل أونلاين
  const swSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
  const codes2 = ['french', 'english', 'arabic', 'math', 'physics', 'chemistry',
                   'history', 'geography', 'philosophy', 'religion', 'national_edu'];
  const missing = codes2.filter((c) => !swSrc.includes(`assets/img/subjects/${c}.webp`));
  ok2('كل صورة مادة مذكورة في SHELL (تعمل أوفلاين)', missing.length === 0, missing.join(' · '));
}
function ok2(n, c, x = '') { if (c) console.log('ok   ' + n); else { bad++; console.log('FAIL ' + n + (x ? ' → ' + x : '')); } }

/* الشريط المتحرّك أُزيل من «الرئيسية» نهائيًا؛ بقي منها مقتطفٌ من صفّين
   بطريقٍ إلى القسم. والوجهة انتقلت من البطاقة إلى زرٍّ داخل صفحة الخبر، فكل
   صفٍّ في القسم يفتح صفحته أيًّا كانت وجهته — والقاعدة القديمة («بلا وجهة لا
   نقر») كانت صحيحة يوم لم تكن ثمّة صفحةٌ تُفتح. */
{
  const homeHtml = Screens.home().outerHTML;
  ok2('لا شريط بانر بـ«الرئيسية»',
      !/class="promo/.test(homeHtml) && !/newsfeed/.test(homeHtml) && !/class="feat/.test(homeHtml));
  /* `class="nrow[ "]` لا `class="nrow` وحدها: الصورة داخل الصفّ تحمل
     `nrow__i` التي تبدأ بالسلسلة نفسها، فيتضاعف العدّ الساذج. */
  ok2('بل مقتطفٌ من صفّين بطريقٍ إلى القسم',
      (homeHtml.match(/class="nrow[ "]/g) || []).length === 2 && /sec-more/.test(homeHtml),
      String((homeHtml.match(/class="nrow[ "]/g) || []).length));

  /* أيّ شرحٍ يراه الطالب — أربع تركيبات، والرسم وحده لا يفحصها: كلّها تُبنى
     بلا استثناء وهي تعرض الشيء الخطأ. القاعدة: قرار المحرِّر (`mode`) هو
     الحَكَم، و`doc` شرطٌ ثانٍ يمنع شاشةً فارغة عند سهوٍ في اللوحة. */
  {
    const lesson = window.SEED.lessons['salutations'];
    const draw = (mode, doc, online = true) => {
      if (mode) lesson.mode = mode; else delete lesson.mode;
      if (doc) lesson.doc = doc; else delete lesson.doc;
      Store.set({ online });
      const html = Screens.lesson({ id: 'salutations', subject: 'fr' }).outerHTML;
      delete lesson.mode; delete lesson.doc; Store.set({ online: true });
      return { pdf: /class="doc"/.test(html), text: /class="prose/.test(html),
               off: /doc__off/.test(html) };
    };

    let r = draw('pdf', 'doc-1');
    ok2('وضع pdf مع ملفّ ⇒ العارض لا النصّ', r.pdf && !r.text);

    r = draw('text', 'doc-1');
    ok2('وضع نصّ ومعه ملفّ مرفوع ⇒ النصّ (المحرِّر لم يقرّر عرضه بعد)',
        r.text && !r.pdf);

    r = draw('pdf', null);
    ok2('وضع pdf بلا ملفّ ⇒ النصّ لا شاشة فارغة', r.text && !r.pdf);

    r = draw(null, null);
    ok2('وبلا وضعٍ محفوظ (جهازٌ زامن قبل الهجرة) ⇒ النصّ', r.text && !r.pdf);

    r = draw('pdf', 'doc-1', false);
    ok2('ووضع pdf دون اتصال ⇒ رسالة صريحة لا فراغ', r.off && !r.pdf);
  }

  const newsHtml = Screens.news().outerHTML;
  ok2('وكل خبرٍ في القسم يفتح صفحته', /class="item"/.test(newsHtml));

  // التجهيزات فيها ثلاثة أخبار — بلا مثبَّت فلا بطاقة مميَّزة
  ok2('ولا بطاقة مميَّزة بلا خبرٍ مثبَّت', !/class="feat"/.test(newsHtml));

  const pin = window.SEED.banners;
  window.SEED.banners = pin.map((p, i) => (i === 1 ? { ...p, pinned: true } : p));
  const pinnedHtml = Screens.news().outerHTML;
  ok2('والمثبَّت يتصدّر ببطاقة كبيرة', /class="feat"/.test(pinnedHtml));
  ok2('ولا يتكرّر في القائمة تحتها',
      (pinnedHtml.match(new RegExp(pin[1].title, 'g')) || []).length === 1);
  window.SEED.banners = pin;
}

fs.writeFileSync(path.join(__dirname, 'render-out.json'), JSON.stringify(out, null, 1));
console.log(bad ? `\n${bad} فشل` : '\nكل الشاشات تُبنى بلا خطأ');
process.exit(bad ? 1 : 0);
