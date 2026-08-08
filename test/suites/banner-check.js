// عدد شرائح البانر صار متغيّرًا (تُدار من اللوحة). الحالات الحدّية — صفر
// وواحد وأكثر من ستّ — هي ما يكسر حركة CSS المضبوطة أصلًا على ثلاث.
require('./render-check-lib.js');

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

const mkB = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({
  id: 'b' + i, title: 'بانر ' + i, sub: 'وصف', image: null, target: null, ...extra,
}));

for (const [n, expect] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [7, 6]]) {
  window.SEED.banners = mkB(n);
  try {
    const html = Screens.home().outerHTML;
    const slides = (html.match(/promo__slide/g) || []).length;
    const cls = (html.match(/class="promo[^"]*"/) || [''])[0];
    ok(`بانرات=${n} ⇒ ${expect} شريحة`, slides === expect, `${slides} · ${cls}`);
  } catch (e) { ok(`بانرات=${n}`, false, e.message); }
}

// شريحة واحدة: ثابتة، بلا نقاط ولا حركة
window.SEED.banners = mkB(1);
let html = Screens.home().outerHTML;
ok('شريحة واحدة تأخذ promo--single', /promo--single/.test(html));
ok('شريحة واحدة بلا نقاط مؤشِّرة', !/promo-dots/.test(html));

// ثلاث: تأخذ صنف العدد وإزاحة لكل شريحة
window.SEED.banners = mkB(3);
html = Screens.home().outerHTML;
ok('ثلاث شرائح تأخذ promo--n3', /promo--n3/.test(html));
ok('لكل شريحة إزاحة زمنية مختلفة',
   /animation-delay:0s/.test(html) && /animation-delay:-4s/.test(html) && /animation-delay:-8s/.test(html));
ok('ثلاث نقاط مؤشِّرة', (html.match(/<i><\/i>/g) || []).length === 3);

// بلا بانرات: لا شيء إطلاقًا — ولا شرائح بديلة، ولا حاوية فارغة تحجز ارتفاعها
window.SEED.banners = [];
html = Screens.home().outerHTML;
ok('بلا بانرات لا تظهر شرائح بديلة', !/منهاجك السوري كاملًا/.test(html));
ok('بلا بانرات لا يُبنى عنصر البانر أصلًا',
   !/class="promo[^"]*"/.test(html) && !/promo__slide/.test(html));
ok('ولا نقاط مؤشِّرة', !/promo-dots/.test(html));
ok('بقيّة الشاشة تُبنى كالمعتاد', /hgreet/.test(html) && /sec-label/.test(html));
// الفجوة تحت التحية تُضبط حسب وجود البانر لا تُترك مضاعفة
ok('هامش التحية يُقلَّص بلا بانر', /margin-bottom:2px/.test(html));
window.SEED.banners = mkB(2);
ok('ويعود كاملًا مع بانر', /margin-bottom:14px/.test(Screens.home().outerHTML));

// صورة + وجهة
window.SEED.banners = [{ id: 'b', title: 'ت', sub: '', image: 'banners/x.png',
                         target: { type: 'subject', value: 'fr' } }];
html = Screens.home().outerHTML;
ok('بانر بوجهة قابل للنقر', /promo__slide--tap/.test(html));
ok('بانر بصورة يضيف الصورة وطبقة التعتيم',
   /promo__img/.test(html) && /promo__scrim/.test(html));
ok('الصورة تُبنى من المسار لا من رابط مخزَّن', /public-media\/banners\/x\.png/.test(html));

// وجهة خارجية
window.SEED.banners = [{ id: 'b', title: 'ت', sub: '', image: null,
                         target: { type: 'url', value: 'https://x.test' } }];
ok('وجهة خارجية لا تكسر البناء', /promo__slide--tap/.test(Screens.home().outerHTML));

window.SEED.banners = [];
console.log('\n' + (bad ? `${bad} فشل` : 'كل فحوصات البانر نجحت'));
process.exit(bad ? 1 : 0);
