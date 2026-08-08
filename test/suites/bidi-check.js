/* =============================================================================
   عرض النصّ المختلط عربي/فرنسي — أهمّ مجموعة فحص في المشروع.

   النصوص أدناه **حقيقية** من محتوى المنهاج ومن لقطات أرسلها المستخدم لأعطالٍ
   وقعت فعلًا. الطريقة السابقة (التقاط «مقاطع لاتينية» بتعبير نمطي) كانت تُخفق
   في كل واحدة منها بشكل مختلف، ولذلك لا يكفي إصلاحها — تحتاج حارسًا دائمًا:
   أي جملة جديدة في المنهاج قد تكشف حالةً لم تخطر ببال أحد.

   ما نتحقّق منه لكل نصّ:
     · اتجاه كل سطر — أوّل حرف قويّ يحدّده، فيُحفظ ترتيب ما كتبه المؤلّف.
     · المقاطع اللاتينية معزولة **ومعها ترقيمها الملاصق** (أقواس، اقتباسات،
       نقطتان) — وهي التي كانت تطير للطرف الخطأ.
     · الماركداون يصير عُقدًا لا نصًّا حرفيًّا.
     · لا نصّ يضيع: مجموع ما يظهر = النصّ الأصلي بعد إزالة علامات الماركداون.
   ============================================================================= */
const fs = require('fs');
const path = require('node:path');
const dir = path.join(__dirname, '..', '..', 'js') + '/';

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

// --- DOM شحيح يحفظ الوسوم والسمات ------------------------------------------------
class N {
  constructor(t) { this.tagName = t; this.children = []; this.attrs = {}; this.className = ''; this._t = null; }
  get classList() { const s = this; return { add(c) { s.className += ' ' + c; } }; }
  setAttribute(k, v) { this.attrs[k] = v; }
  appendChild(c) { this.children.push(c); return c; }
  append(...c) { c.forEach((x) => x && this.appendChild(x)); }
  set textContent(v) { this._t = v; }
  set innerHTML(v) { this._h = v; }
}
global.window = global;
global.document = {
  createElement: (t) => new N(t),
  createElementNS: (n, t) => new N(t),
  createTextNode: (t) => ({ nodeType: 3, data: String(t) }),
};
global.Node = N;
eval(fs.readFileSync(dir + 'ui.js', 'utf8'));

// --- أدوات قراءة الناتج ------------------------------------------------------------
const textOf = (n) => n.nodeType === 3 ? n.data
  : (n._t ?? (n.children || []).map(textOf).join(''));

/** أسطر الناتج: [الاتجاه، النصّ، [المقاطع المعزولة]، [الوسوم]] */
function lines(el) {
  return (el.children || []).filter((l) => textOf(l).trim()).map((l) => {
    const iso = [], tags = [];
    (function walk(n) {
      for (const c of n.children || []) {
        if (c.nodeType === 3) continue;
        if (c.tagName === 'bdi') iso.push(textOf(c));
        else { tags.push(c.tagName); walk(c); }
      }
    })(l);
    return { dir: l.attrs.dir || null, text: textOf(l), iso, tags };
  });
}

// =============================================================================
// ١) الحالات التي كانت تنكسر — كلٌّ منها من عطلٍ حقيقي
// =============================================================================
{
  // القوس الفاتح كان خارج العزل فيطير: ظهر «(صفة) inoubliable » »
  const L = lines(UI.rich('ما معنى الكلمة الفرنسية التالية؟\n« inoubliable » (صفة)'));
  ok('سطران منفصلان لا <br>', L.length === 2, `${L.length} سطرًا`);
  ok('السطر العربي يُعلَن rtl', L[0].dir === 'rtl');
  ok('الاقتباس الفرنسي معزول **مع قوسيه**',
     L[1].iso.some((s) => s.includes('«') && s.includes('»') && s.includes('inoubliable')),
     L[1].iso.join(' | '));
  ok('ولا يبقى قوسٌ عارٍ في السطر',
     !/^\s*«/.test(L[1].text.replace(/^\s+/, '')) || L[1].iso.length > 0);
}

{
  // النقطتان كانتا تقفزان لأقصى اليسار: ظهر «: Grammaire — …»
  const L = lines(UI.rich('الدورة الأولى ٢٠٢٢ (علمي) — Grammaire :\n'
    + '9- La municipalité a publié un calendrier'));
  ok('السطر المختلط يبدأ عربيًّا ⇒ rtl', L[0].dir === 'rtl');
  ok('النقطتان داخل المقطع الفرنسي لا خارجه',
     L[0].iso.some((s) => s.includes('Grammaire') && s.includes(':')), L[0].iso.join(' | '));
  // السطر الفرنسي المرقّم: اتجاهه ltr فيبقى «9-» في محلّه بلا عزل
  ok('السطر الفرنسي المرقّم يُعلَن ltr', L[1].dir === 'ltr');
  ok('ويحتفظ برقمه في أوّله', L[1].text.trim().startsWith('9-'), L[1].text.trim().slice(0, 20));
}

{
  // جملة فرنسية كاملة داخل شرح الدرس — كانت تتشظّى تمامًا
  const L = lines(UI.rich("1- Dans ce document, il s'agit d'un article / d'une annonce"));
  ok('الجملة الفرنسية الكاملة ltr', L[0].dir === 'ltr');
  ok('وتحافظ على ترتيبها', /^1- Dans ce document/.test(L[0].text.trim()), L[0].text.trim().slice(0, 30));
}

{
  // «**» كانت تُعرض حرفيًّا **وتقطع** المقطع الفرنسي إلى ثلاثة
  const L = lines(UI.rich('**inoubliable** = لا يُنسى — من مفردات الوحدة 3.'));
  ok('الماركداون يصير عقدة <b>', L[0].tags.includes('b'), L[0].tags.join(','));
  ok('ولا تظهر النجمات حرفيًّا', !L[0].text.includes('**'), JSON.stringify(L[0].text.slice(0, 30)));
  ok('والمقطع الفرنسي معزول كاملًا لا مشظّى',
     L[0].iso.some((s) => s.trim() === 'inoubliable'), L[0].iso.join(' | '));
  // رقمٌ عربي في آخر جملة عربية كان يُعزل خطأً كأنه فرنسي
  ok('رقمٌ في سياق عربي لا يُعزل', !L[0].iso.some((s) => /^\d+\.?$/.test(s.trim())),
     L[0].iso.join(' | '));
}

// =============================================================================
// ٢) حالات يجب ألّا تتأثّر
// =============================================================================
{
  const L = lines(UI.rich('اختر الإجابة الصحيحة من بين الخيارات.'));
  ok('عربي خالص: rtl وبلا عزل', L[0].dir === 'rtl' && L[0].iso.length === 0);
}
{
  const L = lines(UI.rich("de manière à ce qu'"));
  ok('خيار فرنسي وحده: ltr', L[0].dir === 'ltr');
}
{
  const L = lines(UI.rich('أكمل: Je ___ à l\'école chaque matin.'));
  ok('سؤال فراغات يبقى عربيّ الاتجاه', L[0].dir === 'rtl');
  ok('ولا يبتلع العزلُ الفراغ', L[0].text.includes('___'), L[0].text);
}
{
  // نصّ قراءة بفقرات — الأسطر الفارغة فواصل لا تُبتلع
  const L = lines(UI.rich('الفقرة الأولى.\n\nLa deuxième.\n\nالثالثة.'));
  ok('ثلاث فقرات باتجاهات مستقلّة', L.length === 3, `${L.length}`);
  ok('وكلٌّ باتجاهه', L[0].dir === 'rtl' && L[1].dir === 'ltr' && L[2].dir === 'rtl',
     L.map((x) => x.dir).join(' · '));
}

// =============================================================================
// ٣) لا نصّ يضيع — أهمّ ضمانة: العزل يعيد الترتيب ولا يحذف
// =============================================================================
{
  const CORPUS = [
    'ما معنى الكلمة الفرنسية التالية؟\n« inoubliable » (صفة)',
    'الدورة الأولى ٢٠٢٢ (علمي) — Grammaire :',
    "1- Dans ce document, il s'agit d'un article / d'une annonce / d'un calendrier",
    '**inoubliable** = لا يُنسى — من مفردات الصالون الثقافي، الوحدة 3.',
    'اختر ما يناسب: *le salon* أو *la salle* ؟',
    "L'intelligence artificielle — الذكاء الاصطناعي — تغيّر العالم.",
    'راجع `Unité 5` قبل الامتحان.',
  ];
  let lost = 0; const sample = [];
  const norm = (s) => s.replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();
  for (const t of CORPUS) {
    const got = lines(UI.rich(t)).map((l) => l.text).join(' ');
    if (norm(got) !== norm(t)) { lost++; sample.push(`${JSON.stringify(norm(t).slice(0, 34))} ⇒ ${JSON.stringify(norm(got).slice(0, 34))}`); }
  }
  ok('لا حرف يضيع ولا يتكرّر في كل النصوص', lost === 0, sample[0] || `${CORPUS.length} نصًّا`);
}

console.log('\n' + (bad ? bad + ' فشل' : 'عرض النصّ المختلط سليم'));
process.exit(bad ? 1 : 0);
