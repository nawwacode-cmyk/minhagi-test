/* =============================================================================
   قائمة «موادّي» بالرئيسية — صفّ لكل مادة، سهم يطوي/يفتح أستاذها.

   الرسم الفعلي هو ما يُفحص هنا (بعكس smoke.js الذي يفحص نصّ المصدر فقط):
   أي مادة يظهر سهمها (عندها أستاذ مطابق فعلًا) وأيّها لا، وأن صفّ الأستاذ
   **مفتوح افتراضيًا** لكل مادة لها أستاذ — لا يحتاج نقرة ليظهر.
   ============================================================================= */
require('./render-check-lib.js');

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

// مادة التجهيزات المشترَك بها (fr) عندها أستاذ مطابق (ustaz-sami، subjects:['fr'])
{
  const html = Screens.home().outerHTML;
  ok('صفّ المادة المشترَك بها يظهر بالقائمة', /class="srow(?: is-open)?"/.test(html));
  ok('وفيه سهم لأن عندها أستاذ مطابق', /srow__chev/.test(html));
  ok('وصفّ الأستاذ مفتوح افتراضيًا (بلا نقرة)', /class="steach"/.test(html));
  ok('والصفّ نفسه يحمل is-open افتراضيًا', /class="srow is-open"/.test(html));
  ok('اسم المادة ظاهر بالصفّ', html.includes('اللغة الفرنسية'));
  ok('اسم الأستاذ ظاهر بصفّه المفتوح', html.includes('أستاذ تجريبي'));
}

// مادة إضافية مشترَك بها بلا أستاذ مطابق — بره التجهيزات، مؤقّتًا. لازم تظهر
// مطويّة دائمًا (بلا أستاذ لتعرضه، فلا معنى لفتحها).
{
  const realSubjects = SEED.subjects;
  SEED.subjects = [...realSubjects, { id: 'zz', name: 'مادة بلا أستاذ', native: null, entitled: true }];
  const html = Screens.home().outerHTML;
  ok('المادة الجديدة تظهر بالقائمة', html.includes('مادة بلا أستاذ'));

  const rows = (html.match(/class="srow(?: is-open)?"/g) || []).length;
  const openRows = (html.match(/class="srow is-open"/g) || []).length;
  const chevs = (html.match(/srow__chev/g) || []).length;
  ok('صفّان بالضبط (فرنسي + المادة الجديدة)', rows === 2, String(rows));
  ok('صفّ واحد بس مفتوح (يلي عندها أستاذ)', openRows === 1, String(openRows));
  ok('سهم واحد بس (مادة بلا أستاذ بلا سهم)', chevs === 1, String(chevs));

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
  ok('ولا صفّ واحد يُرسم', !/class="srow/.test(html));
  SEED.subjects = realSubjects;
}

console.log('\n' + (bad ? `${bad} فشل` : 'قائمة موادّي سليمة'));
process.exit(bad ? 1 : 0);
