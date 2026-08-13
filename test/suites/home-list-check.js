/* =============================================================================
   قائمة «موادّي» بالرئيسية — بطاقة لكل مادة، رأس قابل للطيّ يفتح صفّ تفاصيل.

   الرسم الفعلي هو ما يُفحص هنا (بعكس smoke.js الذي يفحص نصّ المصدر فقط):
   أي مادة يظهر صفّ تفاصيلها (عندها أستاذ مطابق فعلًا) وأيّها لا، وأن صفّ
   التفاصيل **مفتوح افتراضيًا** لكل مادة لها أستاذ — لا يحتاج نقرة ليظهر.
   ============================================================================= */
require('./render-check-lib.js');

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

// مادة التجهيزات المشترَك بها (fr) عندها أستاذ مطابق (ustaz-sami، subjects:['fr'])
{
  const html = Screens.home().outerHTML;
  ok('بطاقة المادة المشترَك بها تظهر بالقائمة', /class="subjcard"/.test(html));
  ok('وفيها صفّ تفاصيل لأن عندها أستاذ مطابق', /class="subjcard__row"/.test(html));
  ok('ورابط «تفاصيل المادة» ظاهر', /class="subjcard__foot"/.test(html));
  ok('واسم الأستاذ ظاهر بصفّ التفاصيل المفتوح بلا نقرة', html.includes('أستاذ تجريبي'));
  ok('اسم المادة ظاهر بالبطاقة', html.includes('اللغة الفرنسية'));
}

// مادة إضافية مشترَك بها بلا أستاذ مطابق — بره التجهيزات، مؤقّتًا. لازم تظهر
// مطويّة دائمًا (بلا أستاذ لتعرضه، فلا معنى لفتحها تلقائيًا).
{
  const realSubjects = SEED.subjects;
  SEED.subjects = [...realSubjects, { id: 'zz', name: 'مادة بلا أستاذ', native: null, entitled: true }];
  const html = Screens.home().outerHTML;
  ok('المادة الجديدة تظهر بالقائمة', html.includes('مادة بلا أستاذ'));

  const cards = (html.match(/class="subjcard"/g) || []).length;
  const openRows = (html.match(/class="subjcard__row"/g) || []).length;
  const feet = (html.match(/class="subjcard__foot"/g) || []).length;
  ok('بطاقتان بالضبط (فرنسي + المادة الجديدة)', cards === 2, String(cards));
  ok('صفّ تفاصيل واحد بس مفتوح (يلي عندها أستاذ)', openRows === 1, String(openRows));
  ok('رابط «تفاصيل المادة» واحد بس (يتبع الصفّ المفتوح)', feet === 1, String(feet));

  SEED.subjects = realSubjects;
}

// لا مواد مشترَك بها أصلًا — لا انهيار، ولا قائمة
{
  const realSubjects = SEED.subjects;
  SEED.subjects = realSubjects.map((s) => ({ ...s, entitled: false }));
  let threw = false;
  let html = '';
  try { html = Screens.home().outerHTML; } catch { threw = true; }
  ok('شاشة الرئيسية بلا أي مادة مشترَك بها تُبنى بلا استثناء', !threw);
  ok('ولا بطاقة واحدة تُرسم', !/class="subjcard/.test(html));
  SEED.subjects = realSubjects;
}

// =============================================================================
// ترتيب رأس البطاقة، وصورة المادة، وسطر الأستاذ
//
// الترتيب المطلوب — والصفحة RTL فأوّل عنصرٍ في الـDOM هو **الأيمن**:
//     صورة المادة (يمينًا) · الاسم · السهم (يسارًا)
//
// الترتيب لا يظهر في أي فحصٍ يسأل «هل العنصر موجود؟»، فكلاهما موجود في
// الحالتين. المقياس هو التسلسل نفسه.
// =============================================================================
{
  const realIcon = SEED.subjects[0].icon;
  const realName = SEED.teachers[0].name;
  const realSubs = SEED.teachers[0].subjects;
  SEED.subjects[0].icon = 'subjects/fr.jpg';
  SEED.teachers[0].name = 'نوار بشناق';
  SEED.teachers[0].subjects = [SEED.subjects[0].id];

  const html = Screens.home().outerHTML;
  const head = html.slice(html.indexOf('subjcard__head'), html.indexOf('subjcard__row'));
  const order = [...head.matchAll(/class="(subjcard__badge|grow|ghost-btn)/g)].map((m) => m[1]);

  ok('صورة المادة يمينًا ثم الاسم ثم السهم يسارًا',
     order.join(',') === 'subjcard__badge,grow,ghost-btn', order.join(','));

  /* الصورة المرفوعة **تملأ** البلاطة. كانت تُرسم بمقاس ٢٢ داخل مربّعٍ بنفسجي
     ٤٢، فتبدو ملصقًا صغيرًا وسط لونٍ لا علاقة له بها. */
  ok('والصورة المرفوعة تملأ البلاطة بلا مربّع تحتها',
     /subjcard__badge--img/.test(html) && !/subjcard__badge subj--c/.test(head));

  // بلا صورة مرفوعة: البلاطة الملوّنة بأيقونة المادة تبقى كما كانت
  SEED.subjects[0].icon = null;
  const noIcon = Screens.home().outerHTML;
  ok('وبلا صورة تبقى البلاطة الملوّنة',
     /subjcard__badge subj--c/.test(noIcon) && !/subjcard__badge--img/.test(noIcon));

  SEED.subjects[0].icon = 'subjects/fr.jpg';
  const withIcon = Screens.home().outerHTML;

  /* دائرة الحرف الأوّل أُزيلت: صورة الأستاذ كاملةً إلى جانبها مباشرةً،
     فحرفٌ مصغَّر يكرّر ما تقوله الصورة ويزاحم الاسم. */
  ok('ولا دائرة حرفٍ قبل اسم الأستاذ', !/subjcard__tav/.test(withIcon));
  ok('والاسم كاملًا بلقبه', /أ\. نوار بشناق/.test(withIcon));

  /* الوسم يقول ما في المادة لا ما أنجزه الطالب: «٠ من ٣٨ درسًا» تعرض صفرًا
     لكل من يفتح التطبيق أوّل مرّة، فيبدو المحتوى فارغًا وهو ممتلئ. */
  const pill = (withIcon.match(/subjcard__pill">([^<]*)/) || [])[1] || '';
  ok('والوسم عدد الوحدات لا تقدّم الطالب',
     /وحد/.test(pill) && !/درس/.test(pill) && !/٪/.test(pill), pill);

  SEED.subjects[0].icon = realIcon;
  SEED.teachers[0].name = realName;
  SEED.teachers[0].subjects = realSubs;
}

// صيغة العدد العربية: مفرد ومثنّى وجمع — «٢ وحدات» ركاكةٌ تُلاحَظ
{
  const realUnits = SEED.units;
  const subId = SEED.subjects[0].id;
  const mk = (n) => Array.from({ length: n }, (_, k) => ({
    id: 'tu' + k, title: 'و' + k, subject: subId, grade: 'g9', lessons: [],
  }));
  const pill = () => (Screens.home().outerHTML.match(/subjcard__pill">([^<]*)/) || [])[1];

  for (const [n, want] of [[1, 'وحدة واحدة'], [2, 'وحدتان'], [5, '٥ وحدات'], [12, '١٢ وحدة']]) {
    SEED.units = mk(n);
    ok(`${n} ⇒ «${want}»`, pill() === want, pill());
  }
  SEED.units = [];
  ok('وبلا وحدات: نصٌّ صريح لا صفرٌ عارٍ', pill() === 'لا وحدات بعد', pill());

  SEED.units = realUnits;
}

// =============================================================================
// نقطة تركيز الصورة تصل الواجهة فعلًا
//
// أداةُ ضبطٍ في اللوحة لا يقرؤها التطبيق = محرِّرٌ يضبط ويحفظ ولا يتغيّر شيء،
// وهو أسوأ من غياب الأداة: يظنّ العطل في صورته فيرفع أخرى ثم أخرى.
// =============================================================================
{
  const realIcon = SEED.subjects[0].icon;
  const realPhoto = SEED.teachers[0].photo;
  const realSubs = SEED.teachers[0].subjects;

  SEED.subjects[0].icon = 'subjects/fr.jpg';
  SEED.subjects[0].iconPos = '50% 20%';
  SEED.teachers[0].photo = 'teachers/n.jpg';
  SEED.teachers[0].photoPos = '40% 15%';
  SEED.teachers[0].subjects = [SEED.subjects[0].id];

  let html = Screens.home().outerHTML;
  ok('موضع صورة المادة يصل البلاطة', /object-position:50% 20%/.test(html));
  ok('وموضع صورة الأستاذ يصل صورته', /object-position:40% 15%/.test(html));

  /* القيمة تُحقن في سمة `style`، فتُفحص في العميل أيضًا لا في القاعدة وحدها:
     جهازٌ زامن محتواه قبل إضافة القيد قد يحمل قيمةً لم تمرّ عليه. */
  SEED.subjects[0].iconPos = 'top left; background:url(x)';
  html = Screens.home().outerHTML;
  ok('وقيمةٌ فاسدة تُهمَل ولا تُحقن',
     !/object-position:top/.test(html) && !/background:url/.test(html));

  // بلا موضعٍ محفوظ: لا سمة أصلًا، فيبقى السلوك الافتراضي (الوسط) كما كان
  SEED.subjects[0].iconPos = null;
  SEED.teachers[0].photoPos = null;
  ok('وبلا موضع لا سمة نمط زائدة',
     !/object-position/.test(Screens.home().outerHTML));

  SEED.subjects[0].icon = realIcon;
  SEED.teachers[0].photo = realPhoto;
  SEED.teachers[0].subjects = realSubs;
  delete SEED.subjects[0].iconPos;
  delete SEED.teachers[0].photoPos;
}


console.log('\n' + (bad ? `${bad} فشل` : 'قائمة موادّي سليمة'));
process.exit(bad ? 1 : 0);
