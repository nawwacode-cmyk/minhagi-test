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

console.log('\n' + (bad ? `${bad} فشل` : 'قائمة موادّي سليمة'));
process.exit(bad ? 1 : 0);
