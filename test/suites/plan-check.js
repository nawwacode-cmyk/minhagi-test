/* =============================================================================
   محرّك الخطّة — حسابٌ خالص، فيُفحص بالأرقام لا بالرسم.

   هذه الدوالّ هي كل ما تقوم عليه «خطّتي» والهدف الأسبوعي والروزنامة. وهي
   المكان الذي يُخطئ فيه المرء بصمت: قسمةٌ على صفر، أو يومٌ يُحسب بتوقيت
   UTC فيقع في الأمس، أو وتيرةٌ تعِد بما لا يقع. أخطاءٌ لا يكشفها الرسم —
   الشاشة تُبنى بلا استثناء وهي تعرض رقمًا كاذبًا.
   ============================================================================= */
require('./render-check-lib.js');

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

const K = Store.dayKey();

/** يعيد الحالة إلى نقطة معلومة قبل كل كتلة. */
function fresh(patch = {}) {
  Store.set({
    lessons: {}, doneAt: {}, activeDays: [], focusMin: {}, exams: {},
    pace: 'balanced', daysLeft: 100, ...patch,
  });
}

// عدد دروس المواد المشترَك بها في التجهيزات
fresh();
const TOTAL = Store.plan().total;
ok('التجهيزات فيها دروس نعمل عليها', TOTAL > 0, String(TOTAL));

// =============================================================================
// ١) يوم النشاط بالتوقيت المحلّي لا UTC
//    `toISOString()` يعطي UTC: طالبٌ يدرس بعد منتصف الليل بدمشق كان نشاطه
//    يُسجَّل في يوم أمس، فتخضرّ الخانة الخطأ وينكسر «هدف اليوم» لمن يدرس ليلًا.
// =============================================================================
{
  const d = new Date(2026, 0, 5, 1, 30);      // ١ صباحًا محلّيًا — أمس بتوقيت UTC
  ok('المفتاح يتبع التقويم المحلّي', Store.dayKey(d) === '2026-01-05', Store.dayKey(d));
  ok('والأشهر والأيام بخانتين', Store.dayKey(new Date(2026, 8, 3)) === '2026-09-03',
     Store.dayKey(new Date(2026, 8, 3)));
}

// =============================================================================
// ٢) تسجيل النشاط
// =============================================================================
{
  fresh();
  ok('يبدأ بلا أيام نشطة', Store.get().activeDays.length === 0);

  Store.markActive();
  Store.markActive();
  ok('واليوم يُسجَّل مرّة واحدة مهما تكرّر', Store.get().activeDays.length === 1,
     String(Store.get().activeDays.length));

  fresh();
  const id = Store.plan().todayIds[0];
  Store.completeLesson(id);
  ok('إنجاز درس يجعل اليوم نشطًا', Store.get().activeDays.includes(K));
  ok('ويُسجَّل يومُ إنجازه', Store.get().doneAt[id] === K, Store.get().doneAt[id]);

  fresh();
  Store.recordFocus(25);
  ok('وجلسة التركيز كذلك', Store.get().activeDays.includes(K));
  ok('ودقائقها تُحفظ لليوم', Store.get().focusMin[K] === 25, String(Store.get().focusMin[K]));
  Store.recordFocus(10);
  ok('وتتراكم لا تُستبدل', Store.get().focusMin[K] === 35, String(Store.get().focusMin[K]));
  Store.recordFocus(0);
  ok('وجلسةٌ صفرية لا تُسجَّل', Store.get().focusMin[K] === 35);
}

// =============================================================================
// ٣) الوتيرة — والقسمة على صفر
//    اشتراكٌ منتهٍ (daysLeft = 0) كان سيُنتج Infinity ثم NaN في كل رقم بعده.
// =============================================================================
{
  /* التجهيزات فيها أربعة دروس فقط، وعندها تُصبح الوتائر الثلاث `1` جميعًا
     فيمرّ الفحص بلا أن يفحص. نُكبّر المنهاج مؤقّتًا كي تُنتج الوتائر أرقامًا
     مختلفة فعلًا — وهذا هو الفرق الذي نزعم اختباره. */
  const realUnits = SEED.units;
  const realLessons = SEED.lessons;
  const many = Array.from({ length: 120 }, (_, i) => 'L' + i);
  SEED.units = [{ id: 'u-big', title: 'وحدة كبيرة', subject: 'fr', lessons: many }];
  SEED.lessons = Object.fromEntries(many.map((id) => [id, { id, title: id, minutes: 5 }]));

  fresh({ daysLeft: 30 });
  const bal = Store.plan().perDay;
  Store.setPace('relaxed');
  const rel = Store.plan().perDay;
  Store.setPace('intense');
  const int = Store.plan().perDay;

  ok('الوتائر الثلاث تُنتج أرقامًا مختلفة فعلًا',
     new Set([rel, bal, int]).size === 3, `${rel} · ${bal} · ${int}`);
  ok('والمكثّف أعلى من المتوازن أعلى من المريح',
     int > bal && bal > rel, `${rel} < ${bal} < ${int}`);

  Store.setPace('لا-يوجد');
  ok('ووتيرة مجهولة تُرفض ولا تُخزَّن', Store.get().pace === 'intense', Store.get().pace);

  SEED.units = realUnits;
  SEED.lessons = realLessons;

  fresh({ daysLeft: 0 });
  const p0 = Store.plan();
  ok('بلا مدّة اشتراك لا Infinity ولا NaN',
     Number.isFinite(p0.perDay) && p0.perDay > 0, String(p0.perDay));

  fresh({ daysLeft: 100000 });
  ok('ومدّة طويلة جدًّا تبقي درسًا واحدًا على الأقلّ', Store.plan().perDay >= 1);
}

// =============================================================================
// ٤) قائمة اليوم تمتلئ بما أُنجز فيه
// =============================================================================
{
  fresh({ daysLeft: 10 });
  const before = Store.plan();
  ok('لا شيء مُنجَزًا اليوم بعد', before.doneToday.length === 0);
  ok('وهدف اليوم غير محقَّق', before.metGoal === false);

  before.todayIds.forEach((id) => Store.completeLesson(id));
  const after = Store.plan();
  ok('بعد إنجازها يتحقّق هدف اليوم', after.metGoal === true);
  ok('والمُنجَز اليوم يظهر في القائمة', after.doneToday.length >= before.todayIds.length,
     `${after.doneToday.length}`);
  ok('ولا تُطلب دروسٌ إضافية بعد بلوغ الهدف',
     after.todayIds.length === after.doneToday.length,
     `${after.todayIds.length} مقابل ${after.doneToday.length}`);
}

// =============================================================================
// ٥) التوقّع صادقٌ في الاتجاهين
//    توقّعٌ متفائل كاذب يُفقد الخطّة كلَّها ثقتها من أوّل أسبوع.
// =============================================================================
{
  fresh({ daysLeft: 3650 });        // وقتٌ وافر
  const easy = Store.plan().projection;
  ok('مع وقتٍ وافر: الوتيرة تكفي', easy.enough === true);
  ok('وبهامشٍ موجب', easy.margin > 0, String(easy.margin));

  /* **الحالة التي كانت مستحيلة.** الصياغة الأولى كانت تشتقّ الوتيرة من
     `daysLeft` ثم تسأل أتكفي قبل `daysLeft` — فيخرج «نعم» دائمًا بحكم
     الحساب، ويصير فرعُ «لا تكفي» في الواجهة شيفرةً ميتة لا يراها أحد ولو
     كان الطالب متأخّرًا فعلًا. الوتيرة الآن معدّلٌ مطلق، فللسؤال جواب. */
  fresh({ daysLeft: 1 });                       // يومٌ واحد وأربعة دروس
  const tight = Store.plan().projection;
  ok('ومع وقتٍ ضيّق: الوتيرة **لا** تكفي', tight.enough === false,
     `needDays=${tight.needDays} enough=${tight.enough}`);
  ok('والحكم متّسق مع الأرقام', tight.needDays > 1, String(tight.needDays));
  ok('والهامش سالب', tight.margin < 0, String(tight.margin));

  // ورفع الوتيرة يقرّب النهاية فعلًا — وإلّا فالاختيار زينة
  const slowDays = (() => { fresh({ daysLeft: 1 }); Store.setPace('relaxed');
    return Store.plan().projection.needDays; })();
  const fastDays = (() => { Store.setPace('intense');
    return Store.plan().projection.needDays; })();
  ok('ورفع الوتيرة يقلّل الأيام المطلوبة', fastDays < slowDays, `${fastDays} < ${slowDays}`);

  // كل الدروس مُنجَزة ⇒ لا توقّع أصلًا
  fresh();
  (SEED.units || []).forEach((u) => (u.lessons || []).forEach((id) => Store.completeLesson(id)));
  const done = Store.plan();
  ok('وبانتهاء المنهاج لا بقيّة', done.remaining === 0);
  ok('ولا توقّع يُعرض', done.projection === null);
  ok('ولا هدف يوميّ', done.perDay === 0, String(done.perDay));
}

// =============================================================================
// ٦) الأسبوع — هدفٌ متسامح لا سلسلة تنكسر
// =============================================================================
{
  fresh();
  const w0 = Store.week();
  ok('الأسبوع سبعة أيام', w0.days.length === 7, String(w0.days.length));
  ok('وفيه يومٌ واحد هو اليوم', w0.days.filter((d) => d.today).length === 1);
  ok('ويبدأ بلا إنجاز', w0.hit === 0 && w0.met === false);

  // خمسة أيام من الأسبوع الحالي
  fresh({ activeDays: Store.week().days.slice(0, 5).map((d) => d.key) });
  const w1 = Store.week();
  ok('خمسة أيام تبلغ الهدف', w1.hit === 5 && w1.met === true, `${w1.hit}`);

  /* الفارق عن السلسلة: يومان غائبان **في الوسط** لا يهدمان شيئًا. لو كان
     المقياس سلسلةً متّصلة لعاد الطالب إلى الصفر بعد أوّل انقطاع. */
  const d = Store.week().days;
  fresh({ activeDays: [d[0].key, d[1].key, d[4].key, d[5].key, d[6].key] });
  const w2 = Store.week();
  ok('وانقطاعٌ في الوسط لا يهدم الأسبوع', w2.hit === 5 && w2.met === true, `${w2.hit}`);

  // أيام من أسبوع آخر لا تُحتسب
  fresh({ activeDays: ['2020-01-01', '2020-01-02', '2020-01-03', '2020-01-04', '2020-01-05'] });
  ok('وأيام أسبوعٍ ماضٍ لا تُحتسب', Store.week().hit === 0, String(Store.week().hit));
}

// =============================================================================
// ٧) شبكة الشهر
// =============================================================================
{
  fresh();
  // شباط ٢٠٢٦ يبدأ يوم أحد وفيه ٢٨ يومًا
  const feb = Store.month(2026, 1);
  ok('شباط ٢٠٢٦ فيه ٢٨ خانة يوم',
     feb.cells.filter(Boolean).length === 28, String(feb.cells.filter(Boolean).length));
  ok('ولا فراغ قبله (يبدأ أحدًا)', feb.cells[0] !== null);

  // آذار ٢٠٢٦ يبدأ يوم أحد أيضًا؛ نيسان يبدأ أربعاء ⇒ ثلاثة فراغات
  const apr = Store.month(2026, 3);
  ok('ونيسان يسبقه ثلاثة فراغات',
     apr.cells.filter((c) => c === null).length === 3,
     String(apr.cells.filter((c) => c === null).length));
  ok('وفيه ٣٠ يومًا', apr.cells.filter(Boolean).length === 30);

  // السنة الكبيسة
  ok('وشباط ٢٠٢٤ كبيس: ٢٩ يومًا',
     Store.month(2024, 1).cells.filter(Boolean).length === 29);

  const now = new Date();
  fresh({ activeDays: [K] });
  const cur = Store.month(now.getFullYear(), now.getMonth());
  ok('واليوم مُعلَّم في شهره', cur.cells.filter(Boolean).some((c) => c.today));
  ok('ويومُ النشاط محسوب', cur.activeCount === 1, String(cur.activeCount));
}

// =============================================================================
// ٨) سقف تاريخ النشاط — الحالة تُكتب في localStorage، ومصفوفةٌ بلا حدّ تقترب
//    من الحصّة مع السنين.
// =============================================================================
{
  const many = Array.from({ length: 500 }, (_, i) => `2020-01-${String((i % 28) + 1).padStart(2, '0')}-${i}`);
  fresh({ activeDays: many });
  Store.markActive();
  ok('تاريخ النشاط لا يتجاوز ٤٠٠ يوم', Store.get().activeDays.length <= 400,
     String(Store.get().activeDays.length));
  ok('واليوم يبقى فيه بعد القصّ', Store.get().activeDays.includes(K));
}

console.log('\n' + (bad ? `${bad} فشل` : 'محرّك الخطّة سليم'));
process.exit(bad ? 1 : 0);
