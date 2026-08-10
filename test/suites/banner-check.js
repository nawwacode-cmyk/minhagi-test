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

  /* **يبقى في القائمة أيضًا.** كان يُستبعَد منها، فيبدو للطالب أن الخبر
     «ذهب» حين يُثبَّت ويتعذّر إيجاده بالتصنيف. التصدير إبرازٌ لا نقل. */
  ok('ويبقى في القائمة تحته أيضًا', rows(html) === 4, String(rows(html)));
  ok('فيظهر مرّتين: مصدَّرًا وفي مكانه', (html.match(/خبر 2/g) || []).length === 2,
     String((html.match(/خبر 2/g) || []).length));

  /* مثبَّتان: بطاقةٌ واحدة معروضة في كل لحظة تتبادل بينهما، ومعها نقاط.
     بطاقتان معًا تُلغيان معنى التصدير. */
  window.SEED.banners = mkB(4).map((b, i) => (i < 2 ? { ...b, pinned: true } : b));
  const two = Screens.news().outerHTML;
  ok('ومثبَّتان ⇒ بطاقة واحدة معروضة', (two.match(/class="feat"/g) || []).length === 1,
     String((two.match(/class="feat"/g) || []).length));
  ok('ومعها نقاط للتنقّل بينهما',
     (two.match(/feats__dot/g) || []).length === 2,
     String((two.match(/feats__dot/g) || []).length));
  ok('والقائمة تحتها كاملة', rows(two) === 4, String(rows(two)));

  // مثبَّتٌ واحد: لا نقاط — حركةٌ بلا وجهة ثانية تشويش
  window.SEED.banners = mkB(3).map((b, i) => (i === 0 ? { ...b, pinned: true } : b));
  ok('ومثبَّتٌ واحد بلا نقاط', !/feats__dot/.test(Screens.news().outerHTML));

  /* والمؤقّت نفسه: مثبَّتٌ واحد لا يستحقّ دورةً تعمل إلى الأبد بلا أثر.
     هذا لا يظهر في HTML، فيُقاس بعدّ النداءات — وحارسٌ يقرأ الرسم وحده كان
     يمرّ على مؤقّتٍ زائد لا يراه أحد. */
  const realInterval = global.setInterval;
  let armed = 0;
  global.setInterval = (...a) => { armed++; return realInterval(...a); };

  armed = 0;
  window.SEED.banners = mkB(3).map((b, i) => (i === 0 ? { ...b, pinned: true } : b));
  Screens.news();
  ok('ولا مؤقّت يعمل لمثبَّتٍ واحد', armed === 0, String(armed));

  armed = 0;
  window.SEED.banners = mkB(3).map((b, i) => (i < 2 ? { ...b, pinned: true } : b));
  Screens.news();
  ok('ومؤقّتٌ واحد لمثبَّتين', armed === 1, String(armed));

  global.setInterval = realInterval;
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
    ...mkB(2, { category: 'news' }).map((b) => ({ ...b, id: b.id + 'c' })),
  ];
  const html = Screens.news().outerHTML;
  ok('وتصنيفان ⇒ شرائح تظهر', /class="nchip[ "]/.test(html));
  ok('ومعها «الكل»', /الكل/.test(html));
  ok('و«إعلانات» و«أخبار»', /إعلانات/.test(html) && /أخبار/.test(html));
  ok('ولا شريحة لتصنيفٍ غائب', !/تحديثات التطبيق/.test(html));
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

  /* صورٌ متعدّدة: شريطٌ يُسحب مع نقاط. وصورةٌ واحدة تبقى صورةً واحدة — شريطٌ
     بنقطةٍ واحدة يوحي بوجود ما ليس موجودًا. */
  window.SEED.banners = mkB(1, { images: ['banners/a.png', 'banners/b.png', 'banners/c.png'] });
  let g = Screens.post({ id: 'b0' }).outerHTML;
  ok('ثلاث صور ⇒ معرضٌ بثلاث', (g.match(/class="gal__i"/g) || []).length === 3);
  ok('ومعه ثلاث نقاط', (g.match(/<i/g) || []).length >= 3);

  window.SEED.banners = mkB(1, { images: ['banners/a.png'] });
  g = Screens.post({ id: 'b0' }).outerHTML;
  ok('وصورةٌ واحدة بلا معرض', !/class="gal/.test(g) && /post__i/.test(g));

  window.SEED.banners = mkB(1, { images: [] });
  ok('وبلا صور لا معرض ولا صورة مكسورة',
     !/class="gal/.test(Screens.post({ id: 'b0' }).outerHTML));
}

// =============================================================================
// ٧٫٥) المصدر والرابط
// =============================================================================
{
  window.SEED.banners = mkB(1, { source: 'وزارة التربية', link: 'https://moed.gov.sy/x' });
  const html = Screens.post({ id: 'b0' }).outerHTML;
  ok('المصدر يظهر سطرًا', /post__src/.test(html) && /وزارة التربية/.test(html));
  /* الرابط `<a>` لا `<button>`: الطالب يريد أحيانًا نسخه أو فتحه في تبويب،
     وزرٌّ يُنفّذ `window.open` يمنع الاثنين. و`noopener` شرطُ أمان لا تجميل. */
  ok('والرابط وسم <a> يفتح خارج التطبيق',
     /<a[^>]*href="https:\/\/moed\.gov\.sy\/x"/.test(html) && /target="_blank"/.test(html));
  ok('ومعه noopener', /rel="noopener noreferrer"/.test(html));

  window.SEED.banners = mkB(1);
  const bare = Screens.post({ id: 'b0' }).outerHTML;
  ok('وبلا مصدر ولا رابط لا يظهر أيّهما',
     !/post__src/.test(bare) && !/فتح الرابط/.test(bare));
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
  /* كومةٌ من ثلاث بطاقات ظاهرة من عشرة — لا صفوف. عرضُ العشرة كلّها يجعل
     تبويب «آخر الأخبار» بلا سبب لوجوده. */
  ok('وكومةٌ بثلاث بطاقات ظاهرة',
     (html.match(/class="scard"/g) || []).length === 3,
     String((html.match(/class="scard"/g) || []).length));
  ok('وطريقٌ إلى القسم', /sec-more/.test(html));
  ok('وبقيّة «الرئيسية» تُبنى كالمعتاد', /hgreet/.test(html) && /sec-label/.test(html));

  window.SEED.banners = [];
  ok('وبلا أخبار يختفي القسم من الرئيسية بلا عنوانٍ يتيم',
     !/آخر الأخبار/.test(Screens.home().outerHTML));
}


// =============================================================================
// ٩) كومة الأخبار في «الرئيسية»
//
// الفكرة من مكوّن React بـframer-motion، مُعادةٌ بفانيلا JS كسبينر القلم.
// وحالاتها الحدّية هي التي تكسرها: خبرٌ واحد، وأقلّ من ثلاثة، وأكثر من عشرة،
// ومن طلب تقليل الحركة.
// =============================================================================
{
  const home = () => Screens.home().outerHTML;
  const cards = (html) => (html.match(/class="scard"/g) || []).length;
  const realInterval = global.setInterval;
  const realMatch = global.matchMedia;
  let armed = 0;
  global.setInterval = (...a) => { armed++; return realInterval(...a); };

  window.SEED.banners = mkB(14);
  let html = home();
  ok('١٤ خبرًا ⇒ ثلاث بطاقات ظاهرة', cards(html) === 3, String(cards(html)));
  // عشرة لا أربعة عشر: المطلوب «أحدث عشرة»
  ok('والعدّاد يقول عشرة', /١٠ أخبار/.test(html));

  /* الأبعد أوّلًا في الـDOM فالأقرب يعلوه بلا z-index لكل بطاقة. والواجهة
     هي **آخر عقدة** — وعليها يعتمد التبديل، فانقلاب الترتيب يجعل الكومة
     تُخرج البطاقة الخطأ. */
  const stack = html.slice(html.indexOf('nstack__w'));
  const order = [...stack.matchAll(/--p:(\d)"/g)].map((m) => m[1]).slice(0, 3).join(',');
  ok('وترتيبها من الأبعد إلى الأقرب', order === '2,1,0', order);

  // الخلفيتان خارج مسار اللمس ولوحة المفاتيح: زخرفةٌ لا هدف
  ok('والخلفيتان مخفيّتان عن قارئ الشاشة',
     (html.match(/aria-hidden="true"/g) || []).length >= 2);

  armed = 0; window.SEED.banners = mkB(5); home();
  ok('وأكثر من خبر ⇒ مؤقّتٌ واحد', armed === 1, String(armed));

  armed = 0; window.SEED.banners = mkB(1);
  html = home();
  ok('وخبرٌ واحد ⇒ بطاقة واحدة', cards(html) === 1, String(cards(html)));
  ok('ولا مؤقّت له', armed === 0, String(armed));
  ok('ولا زرّ تالٍ', !/nstack__b/.test(html));

  armed = 0; window.SEED.banners = mkB(2);
  ok('وخبران ⇒ بطاقتان', cards(home()) === 2);

  /* من طلب تقليل الحركة: الكومة ساكنة ولا مؤقّت. تجاهلُ هذا الطلب ليس
     تفصيلًا تجميليًّا — الحركة التلقائية تُدوّخ بعض المستخدمين فعلًا. */
  armed = 0;
  global.matchMedia = (q) => ({ matches: /prefers-reduced-motion/.test(q), addEventListener() {} });
  window.SEED.banners = mkB(6); home();
  ok('ومن طلب تقليل الحركة لا مؤقّت له', armed === 0, String(armed));

  global.matchMedia = realMatch;
  global.setInterval = realInterval;
}

console.log('\n' + (bad ? `${bad} فشل` : 'قسم الأخبار سليم'));
process.exit(bad ? 1 : 0);

console.log('\n' + (bad ? `${bad} فشل` : 'قسم الأخبار سليم'));
process.exit(bad ? 1 : 0);
