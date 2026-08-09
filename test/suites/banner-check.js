// البانر أُزيل من «الرئيسية» نهائيًا وصار حصرًا ضمن «آخر الأخبار»: لا حدّ
// ستّة ولا دورة تلاشٍ CSS — قائمة ثابتة تُقرأ بالتمرير، فالحالات الحدّية
// هنا هي صفر (حالة فارغة صريحة) وواحد وعدد كبير (لا سقف يقصّه).
//
// العدّ بـ`class="newsfeed__card` لا `newsfeed__card` وحدها: بطاقة بهدف
// مخصَّص تحمل صنف `newsfeed__card--tap` الذي يحتوي السلسلة الأولى داخله
// فيضاعف العدّ الساذج. مرساة `class="` تلتقط جذر العنصر مرّة واحدة لا مرّتين.
require('./render-check-lib.js');

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

const mkB = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({
  id: 'b' + i, title: 'بانر ' + i, sub: 'وصف', image: null, target: null, ...extra,
}));

for (const n of [0, 1, 2, 7]) {
  window.SEED.banners = mkB(n);
  try {
    const html = Screens.news().outerHTML;
    const cards = (html.match(/class="newsfeed__card/g) || []).length;
    ok(`بانرات=${n} ⇒ ${n} بطاقة (بلا سقف)`, cards === n, `${cards}`);
  } catch (e) { ok(`بانرات=${n}`, false, e.message); }
}

// بلا بانرات: حالة فارغة صريحة — لا نخترع محتوًى لملء الفراغ
window.SEED.banners = [];
let html = Screens.news().outerHTML;
ok('بلا بانرات: لا بطاقات', !/class="newsfeed__card/.test(html));
ok('بلا بانرات: حالة فارغة صريحة', /لا أخبار منشورة بعد/.test(html));
ok('العنوان يبقى «آخر الأخبار»', /appbar__title/.test(html) && /آخر الأخبار/.test(html));

// «الرئيسية» لم يعد فيها أي أثر للبانر مهما كان عدده
window.SEED.banners = mkB(3);
html = Screens.home().outerHTML;
ok('«الرئيسية» بلا أثر بانر رغم وجود بانرات', !/class="promo/.test(html) && !/newsfeed/.test(html));
ok('بقيّة «الرئيسية» تُبنى كالمعتاد', /hgreet/.test(html) && /sec-label/.test(html));

// صورة + وجهة
window.SEED.banners = [{ id: 'b', title: 'ت', sub: '', image: 'banners/x.png',
                         target: { type: 'subject', value: 'fr' } }];
html = Screens.news().outerHTML;
ok('بانر بوجهة قابل للنقر', /newsfeed__card--tap/.test(html));
ok('بانر بصورة يضيف الصورة وطبقة التعتيم',
   /newsfeed__img/.test(html) && /newsfeed__scrim/.test(html));
ok('الصورة تُبنى من المسار لا من رابط مخزَّن', /public-media\/banners\/x\.png/.test(html));

// بلا وجهة: إعلامي محض — لا معنى للنقر لتصل إلى الشاشة التي أنت بداخلها
window.SEED.banners = [{ id: 'b', title: 'ت', sub: '', image: null, target: null }];
ok('بانر بلا هدف داخل «آخر الأخبار» غير قابل للنقر',
   !/newsfeed__card--tap/.test(Screens.news().outerHTML));

// وجهة خارجية
window.SEED.banners = [{ id: 'b', title: 'ت', sub: '', image: null,
                         target: { type: 'url', value: 'https://x.test' } }];
ok('وجهة خارجية لا تكسر البناء', /newsfeed__card--tap/.test(Screens.news().outerHTML));

window.SEED.banners = [];
console.log('\n' + (bad ? `${bad} فشل` : 'كل فحوصات البانر نجحت'));
process.exit(bad ? 1 : 0);
