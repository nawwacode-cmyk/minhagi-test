/* =============================================================================
   «آخر الأخبار» — الحالات الحدّية

   القسم كان بطاقاتٍ متطابقة بلا تاريخ ولا تصنيف. صار: خبرٌ مثبَّت يتصدّر،
   ثم شرائح تصنيف، ثم قائمة بتواريخ وشارة «جديد». والحالات الحدّية هي التي
   تكسر تصميمًا كهذا: صفر أخبار، وخبرٌ واحد، وعددٌ كبير، ومثبَّتان، وتصنيفٌ
   واحد، وتاريخٌ فاسد.

   العدّ بمرساة `class="x[ "]` لا `class="x` وحدها: أصنافٌ كثيرة هنا تتشارك
   البادئة (`item` و`item__i`، و`nrow` و`nrow__i`)، والعدّ الساذج يضاعف.
   ============================================================================= */
require('./render-check-lib.js');

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

const DAY = 86_400_000;
const mkB = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({
  id: 'b' + i, title: 'خبر ' + i, sub: 'وصف', image: null, target: null,
  at: new Date(Date.now() - (i + 1) * DAY).toISOString(),
  category: 'announcement', pinned: false, body: '', onHome: true, ...extra,
}));
const rows = (html) => (html.match(/class="item[ "]/g) || []).length;

// =============================================================================
// ١) العدد — بلا سقف يقصّ
// =============================================================================
for (const n of [0, 1, 2, 7, 40]) {
  window.SEED.banners = mkB(n);
  try {
    ok(`أخبار=${n} ⇒ ${n} صفًّا (بلا سقف)`, rows(Screens.news().outerHTML) === n,
       String(rows(Screens.news().outerHTML)));
  } catch (e) { ok(`أخبار=${n}`, false, e.message); }
}

// =============================================================================
// ٢) الحالة الفارغة صريحة — لا نخترع محتوًى لملء الفراغ
// =============================================================================
{
  window.SEED.banners = [];
  const html = Screens.news().outerHTML;
  ok('بلا أخبار: لا صفوف', rows(html) === 0);
  ok('وحالة فارغة صريحة', /لا أخبار منشورة بعد/.test(html));
  ok('والعنوان يبقى «آخر الأخبار»', /appbar__title/.test(html) && /آخر الأخبار/.test(html));
  ok('ولا بطاقة مميَّزة فارغة', !/class="feat"/.test(html));
}

// =============================================================================
// ٣) المثبَّت يتصدّر — ولا يتكرّر
// =============================================================================
{
  window.SEED.banners = mkB(4).map((b, i) => (i === 2 ? { ...b, pinned: true } : b));
  const html = Screens.news().outerHTML;
  ok('المثبَّت يظهر ببطاقة كبيرة', /class="feat"/.test(html));
  ok('وعليه وسم «مثبَّت»', /feat__tag/.test(html) && /مثبَّت/.test(html));
  ok('ولا يتكرّر في القائمة تحته', (html.match(/خبر 2/g) || []).length === 1,
     String((html.match(/خبر 2/g) || []).length));
  ok('وبقيّة الأخبار صفوف', rows(html) === 3, String(rows(html)));

  /* مثبَّتان: واحدٌ يتصدّر لا اثنان. بطاقتان كبيرتان تُلغيان معنى التصدير،
     والمدير قد ينسى إلغاء تثبيت السابق. */
  window.SEED.banners = mkB(4).map((b, i) => (i < 2 ? { ...b, pinned: true } : b));
  const two = Screens.news().outerHTML;
  ok('ومثبَّتان ⇒ بطاقة كبيرة واحدة', (two.match(/class="feat"/g) || []).length === 1,
     String((two.match(/class="feat"/g) || []).length));
  ok('والثاني ينزل إلى القائمة', rows(two) === 3, String(rows(two)));
}

// =============================================================================
// ٤) الشرائح تُبنى من الموجود فعلًا
//    شريحةٌ تُنقر فلا يظهر شيء أسوأ من غياب التصنيف.
// =============================================================================
{
  window.SEED.banners = mkB(3);                      // كلّها 'announcement'
  ok('تصنيفٌ واحد ⇒ لا شرائح أصلًا',
     !/class="nchip[ "]/.test(Screens.news().outerHTML));

  window.SEED.banners = [
    ...mkB(2),
    ...mkB(2, { category: 'content' }).map((b) => ({ ...b, id: b.id + 'c' })),
  ];
  const html = Screens.news().outerHTML;
  ok('وتصنيفان ⇒ شرائح تظهر', /class="nchip[ "]/.test(html));
  ok('ومعها «الكل»', /الكل/.test(html));
  ok('و«إعلانات» و«محتوى جديد»', /إعلانات/.test(html) && /محتوى جديد/.test(html));
  ok('ولا شريحة لتصنيفٍ غائب', !/تحديثات/.test(html));
  ok('و«الكل» مختارة ابتداءً', /class="nchip is-on"/.test(html));

  // تصنيفٌ مجهول من خادمٍ أحدث لا يُنتج شريحةً بلا اسم
  window.SEED.banners = mkB(2, { category: 'شيء-جديد' });
  ok('وتصنيف مجهول لا يُنتج شريحة فارغة', !/class="nchip[ "]/.test(Screens.news().outerHTML));
}

// =============================================================================
// ٥) التاريخ
// =============================================================================
{
  window.SEED.banners = [{ ...mkB(1)[0], at: new Date(Date.now() - 3 * 3600_000).toISOString() }];
  ok('«منذ ٣ ساعات» لا تاريخ مطلق', /منذ ٣ ساعات/.test(Screens.news().outerHTML));

  window.SEED.banners = [{ ...mkB(1)[0], at: new Date(Date.now() - 90_000).toISOString() }];
  ok('ودقائق للقريب جدًّا', /دقيقة|دقائق/.test(Screens.news().outerHTML));

  /* تاريخٌ فاسد أو غائب: جهازٌ زامن قبل الهجرة يحمل أخبارًا بلا `at`. لا
     يُرسم «Invalid Date» ولا «NaN» — الشاشة تُبنى والسطر يسقط بصمت. */
  for (const at of [null, undefined, 'ليس تاريخًا', '']) {
    window.SEED.banners = [{ ...mkB(1)[0], at }];
    const html = Screens.news().outerHTML;
    ok(`تاريخ «${String(at)}» لا يكسر الشاشة`,
       !/Invalid Date/.test(html) && !/NaN/.test(html) && rows(html) === 1);
  }
}

// =============================================================================
// ٦) شارة «جديد» — محلّية بالنسبة إلى القارئ لا إلى الخبر
// =============================================================================
{
  const fresh = new Date(Date.now() - 3600_000).toISOString();
  const old   = new Date(Date.now() - 40 * DAY).toISOString();
  window.SEED.banners = [{ ...mkB(1)[0], id: 'n1', at: fresh },
                         { ...mkB(1)[0], id: 'n2', at: old }];

  Store.set({ newsSeenAt: null });
  ok('قارئٌ لم يفتح القسم قط يرى «جديد»', /tag-new/.test(Screens.news().outerHTML));

  Store.set({ newsSeenAt: fresh });
  ok('ومن قرأ الأحدث لا يرى شارة', !/tag-new/.test(Screens.news().outerHTML));

  Store.set({ newsSeenAt: old });
  const mid = Screens.news().outerHTML;
  ok('ومن قرأ القديم وحده يرى شارةً واحدة',
     (mid.match(/tag-new/g) || []).length === 1, String((mid.match(/tag-new/g) || []).length));
}

// =============================================================================
// ٧) الصورة تُبنى من المسار لا من رابطٍ مخزَّن
// =============================================================================
{
  window.SEED.banners = mkB(1, { image: 'banners/x.png' });
  const html = Screens.news().outerHTML;
  ok('صورة الخبر من المسار', /public-media\/banners\/x\.png/.test(html));
  ok('وبلا صورة يظهر بديلٌ لا مستطيلٌ مكسور',
     (() => { window.SEED.banners = mkB(1); return /item__i--blank/.test(Screens.news().outerHTML); })());
}

// =============================================================================
// ٨) صفحة الخبر
// =============================================================================
{
  window.SEED.banners = mkB(1, { body: '<p>نصّ الخبر</p>', target: { type: 'subject', value: 'fr' } });
  const id = window.SEED.banners[0].id;
  const html = Screens.post({ id }).outerHTML;
  ok('صفحة الخبر تعرض عنوانه', /post__t/.test(html) && /خبر 0/.test(html));
  ok('ونصّه', /نصّ الخبر/.test(html));
  ok('وزرّ الوجهة', /اذهب إلى الوجهة/.test(html));

  window.SEED.banners = mkB(1);        // بلا نصّ ولا وجهة
  const bare = Screens.post({ id: window.SEED.banners[0].id }).outerHTML;
  ok('وبلا نصّ تُبنى الصفحة بلا فراغ يبدو عطلًا', /post__t/.test(bare));
  ok('وبلا وجهة لا زرّ', !/اذهب إلى الوجهة/.test(bare));

  // معرّف مجهول (خبرٌ حُذف بينما الطالب يقرأ) يعود إلى القائمة لا ينهار
  ok('ومعرّفٌ مجهول يعود إلى القائمة بلا انهيار',
     /آخر الأخبار/.test(Screens.post({ id: 'لا-يوجد' }).outerHTML));
}

// =============================================================================
// ٩) «الرئيسية» — مقتطفٌ لا شريط
// =============================================================================
{
  window.SEED.banners = mkB(7);
  const html = Screens.home().outerHTML;
  ok('«الرئيسية» بلا شريط بانر رغم سبعة أخبار',
     !/class="promo/.test(html) && !/class="feat/.test(html) && !/newsfeed/.test(html));
  ok('ومقتطفٌ من صفّين لا أكثر',
     (html.match(/class="nrow[ "]/g) || []).length === 2,
     String((html.match(/class="nrow[ "]/g) || []).length));
  ok('وطريقٌ إلى القسم', /sec-more/.test(html));
  ok('وبقيّة «الرئيسية» تُبنى كالمعتاد', /hgreet/.test(html) && /sec-label/.test(html));

  window.SEED.banners = [];
  ok('وبلا أخبار يختفي القسم من الرئيسية بلا عنوانٍ يتيم',
     !/آخر الأخبار/.test(Screens.home().outerHTML));
}

console.log('\n' + (bad ? `${bad} فشل` : 'قسم الأخبار سليم'));
process.exit(bad ? 1 : 0);
