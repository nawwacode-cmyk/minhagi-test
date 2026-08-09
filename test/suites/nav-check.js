/* =============================================================================
   سلوك الرجوع — يقود `App` الحقيقي لا نسخة عنه.

   العطل الذي أوجب هذه المجموعة: الطالب يحدّث الصفحة وهو في درس، فيُستأنف
   الدرس وحده في السجل (طوله ١)، وشرطُ `stack.length > 1` في `back()` يمنع
   أي حركة — فيُعاد رسم الشاشة نفسها ويبدو الزرّ معطَّلًا. وزرّ رجوع الهاتف
   أسوأ: لا يتنقّل ولا يُعيد بذر العلامة، فالضغطة التالية تُخرج الطالب من
   درسه بلا سابق إنذار.

   لا فحص نصّي هنا: نُشغّل `go`/`back` فعلًا ونقرأ الشاشة الظاهرة. فحصُ
   المصدر كان سيمرّ على هذا العطل — الشرط مكتوب وصحيح نحويًّا، وخطؤه في
   الحالة التي لم تخطر ببال أحد.
   ============================================================================= */
require('./render-check-lib.js');

let bad = 0;
const ok = (n, c, x = '') => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' → ' + x : '')); if (!c) bad++; };

// --- التقاط الشاشة المعروضة -------------------------------------------------
// `render` الحقيقية تكتب في `view`؛ نعترض `Screens` لنعرف أيّها استُدعيت.
let shown = null;
for (const name of Object.keys(Screens)) {
  const orig = Screens[name];
  Screens[name] = (p) => { shown = { name, params: p || {} }; return orig(p); };
}

// سجلّ متصفّح شحيح — يكفي لملاحظة بذر العلامة واستهلاكها
// `showSplash` تُلحق غطاءها بـ`document.body` — غير موجود في الـDOM الشحيح
document.body = { appendChild() {}, removeChild() {} };

const entries = [];
let popHandler = null;
global.history = {
  get state() { return entries[entries.length - 1] ?? null; },
  pushState(st) { entries.push(st); },
};
global.addEventListener = (ev, fn) => { if (ev === 'popstate') popHandler = fn; };
global.matchMedia = () => ({ addEventListener() {}, matches: false });
global.location = { protocol: 'http:', reload() {} };
global.navigator = { onLine: true };
global.setInterval = () => 0;
global.setTimeout = (fn) => { void fn; return 0; };   // لا سبلاش ولا مؤقّتات

/* `render-check-lib` تضع `App` وهميًّا — نحمّل الحقيقي فوقه: المفحوص هنا هو
   منطق السجل نفسه، وبديلٌ عنه يفحص البديل. يُحمَّل **بعد** ضبط
   `history`/`addEventListener` أعلاه لأن `boot` تسجّل مستمعها فيهما. */
const APP_SRC = require('node:fs').readFileSync(
  require('node:path').join(__dirname, '..', '..', 'js', 'app.js'), 'utf8');

Store.set({ signedIn: true, activated: true, username: 'أحمد', grade: 'g12' });

/**
 * يبدأ التطبيق من مسار محفوظ بعينه (يحاكي تحديث الصفحة).
 *
 * تُعاد قراءة `app.js` في كل مرّة: `stack` ثابتٌ في غلاف الوحدة ولا تصفّره
 * `boot`، فلو أقلعنا مرّتين لتراكمت الشاشات وصار السجل طويلًا فمرّت فحوص
 * «الجذر» على بقايا الكتلة السابقة لا على ما تدّعي فحصه. في التطبيق الحقيقي
 * `boot` تجري مرّة واحدة لكل تحميل صفحة، فهذا فرقُ بيئةٍ لا عطلُ منتَج.
 */
function bootAt(route) {
  entries.length = 0;
  shown = null;
  Store.set({ route });
  eval(APP_SRC);          // غلافٌ جديد ⇒ سجلٌّ خاوٍ
  App.boot();             // تبني الهيكل وتضبط السجل ثم ترسم
  return shown;
}

/* زرّ رجوع الهاتف. المتصفّح يُسقط المدخلة **ثم** يُطلق `popstate` — ولولا
   الإسقاط هنا لبدت العلامة باقيةً إلى الأبد فمرّ فحصُ «الجذر بلا علامة»
   وهو كاذب. تُعاد `false` إن لم يبقَ في السجل شيء: أي أن المتصفّح غادر
   التطبيق، وهو ما نريده على الجذر تحديدًا. */
function hwBack() {
  if (!entries.length) return false;     // لا مدخلة تُستهلك ⇒ خروج
  entries.pop();
  if (popHandler) popHandler();
  return true;
}

// =============================================================================
// ١) العطل الأصلي: تحديث الصفحة داخل درس
// =============================================================================
{
  const at = bootAt({ name: 'lesson', params: { id: 'salutations', subject: 'fr' } });
  ok('الاستئناف يفتح الدرس نفسه', at?.name === 'lesson', at?.name);

  App.back();
  ok('والرجوع يصعد إلى المادة لا يبقى مكانه',
     shown?.name === 'course', shown?.name);
  ok('ومعه المادة الصحيحة', shown?.params?.subject === 'fr', shown?.params?.subject);

  App.back();
  ok('ثم إلى «موادّي»', shown?.name === 'subjects', shown?.name);
}

// =============================================================================
// ٢) زرّ رجوع الهاتف — نفس الحالة
// =============================================================================
{
  bootAt({ name: 'lesson', params: { id: 'salutations', subject: 'fr' } });
  ok('علامةٌ في سجلّ المتصفّح ما دام في التطبيق ما نرجع إليه',
     history.state?.app === true, JSON.stringify(entries));

  hwBack();
  ok('وزرّ الهاتف ينزل إلى المادة لا يغادر التطبيق',
     shown?.name === 'course', shown?.name);

  hwBack();
  ok('ثم إلى «موادّي»', shown?.name === 'subjects', shown?.name);

  hwBack();
  ok('ثم إلى الرئيسية', shown?.name === 'home', shown?.name);

  // على الجذر لا علامة: الضغطة التالية يجب أن تغادر التطبيق لا أن تُحبس فيه
  ok('وعلى الجذر لا علامة (فالخروج ممكن)', !history.state?.app,
     JSON.stringify(history.state));
  ok('والضغطة التالية تغادر التطبيق ولا تحبس الطالب', hwBack() === false);
}

// =============================================================================
// ٣) العلامة تُبذر من جديد بعد استهلاكها
//    لو بُذرت عند الإقلاع وحده لخرج الطالب من التطبيق عند أوّل رجوع من درس
//    دخله بعد وصوله إلى الجذر.
// =============================================================================
{
  bootAt({ name: 'home', params: {} });
  ok('الجذر يبدأ بلا علامة', !history.state?.app);

  App.go('course', { subject: 'fr' });
  ok('والدخول إلى شاشة أعمق يبذرها', history.state?.app === true);

  App.go('lesson', { id: 'salutations', subject: 'fr' });
  ok('ولا تتكدّس علامتان', entries.filter((e) => e?.app).length === 1,
     `${entries.filter((e) => e?.app).length}`);
}

// =============================================================================
// ٤) الاستئناف يبذر الأب تحت الشاشة العميقة
// =============================================================================
{
  bootAt({ name: 'practice', params: { lesson: 'salutations', subject: 'fr' } });
  App.back();
  ok('التمارين ترجع إلى المادة', shown?.name === 'course', shown?.name);

  bootAt({ name: 'result', params: { id: 'x', subject: 'fr', pct: 50, got: 1, total: 2 } });
  App.back();
  ok('والنتيجة كذلك', shown?.name === 'course', shown?.name);
  ok('على تبويب الامتحانات', shown?.params?.tab === 'exams', shown?.params?.tab);

  bootAt({ name: 'teacher', params: { id: 'ustaz-sami' } });
  App.back();
  ok('وملفّ الأستاذ يرجع إلى الرئيسية', shown?.name === 'home', shown?.name);
}

// =============================================================================
// ٥) تبويبات الشريط: الرئيسية وحدها جذر
//
//    «تقدّمي» و«آخر الأخبار» تعرضان سهم رجوع في شريط العنوان. حين يفتحهما
//    الطالب من الشريط السفلي يعمل السهم (السجل غير خاوٍ)، لكنه يموت بعد
//    تحديث الصفحة — سهمٌ ظاهرٌ لا يفعل شيئًا. فأيّ تبويب يرجع إلى الرئيسية،
//    والرئيسية وحدها تُغادر التطبيق.
// =============================================================================
{
  for (const tab of ['subjects', 'progress', 'news']) {
    bootAt({ name: tab, params: {} });
    App.back();
    ok(`«${tab}» يرجع إلى الرئيسية لا يجمد`, shown?.name === 'home', shown?.name);
  }

  bootAt({ name: 'home', params: {} });
  App.back();
  ok('و«الرئيسية» جذر: لا تتحرّك ولا ترمي', shown?.name === 'home', shown?.name);
  ok('ولا علامة فوقها (فالخروج ممكن)', !history.state?.app);
}

// =============================================================================
// ٦) الرجوع من شاشة دُفعت فوق أخرى يعود إليها هي لا إلى الأب
// =============================================================================
{
  bootAt({ name: 'home', params: {} });
  App.go('subjects');
  App.go('course', { subject: 'fr' });
  App.go('lesson', { id: 'salutations', subject: 'fr' });
  App.back();
  ok('السجل الحقيقي يسبق الأب المفترض', shown?.name === 'course', shown?.name);
  App.back();
  ok('ثم موادّي', shown?.name === 'subjects', shown?.name);
  App.back();
  ok('ثم الرئيسية', shown?.name === 'home', shown?.name);
}

// =============================================================================
// ٧) زرٌّ يستبدل الشاشة بما هو تحتها أصلًا ⇒ مدخلتان متطابقتان
//
//    شكوى الطالب «في أزرار بتبقى بنفس الصفحة»: «إلى كل الامتحانات» في ورقة
//    النتيجة يستبدلها بـ«المادة/الامتحانات» — وهي المدخلة التي تحتها أصلًا.
//    فيرى المادة، ثم يضغط رجوع فيرى المادة نفسها ثانيةً. الزرّ سليم والسجل
//    كاذب.
// =============================================================================
{
  bootAt({ name: 'home', params: {} });
  App.go('subjects');
  App.go('course', { subject: 'fr', tab: 'exams' });
  App.go('exam', { id: 'fr-final', subject: 'fr' });
  // «إلى كل الامتحانات» من ورقة النتيجة
  App.go('result', { id: 'fr-final', subject: 'fr', pct: 80, got: 4, total: 5 }, true);
  App.go('course', { tab: 'exams', subject: 'fr' }, true);
  ok('الزرّ يُظهر المادة', shown?.name === 'course', shown?.name);

  App.back();
  ok('والرجوع بعده لا يُعيد الشاشة نفسها',
     shown?.name !== 'course', shown?.name);
  ok('بل يصعد إلى «موادّي»', shown?.name === 'subjects', shown?.name);
}

// =============================================================================
// ٨) الاستبدال لا يُكرّر المدخلة المستأنَفة
//    نفس الحالة بعد تحديث الصفحة على ورقة النتيجة: الأب مبذور تحتها.
// =============================================================================
{
  bootAt({ name: 'result', params: { id: 'fr-final', subject: 'fr', pct: 80, got: 4, total: 5 } });
  App.go('course', { tab: 'exams', subject: 'fr' }, true);
  App.back();
  ok('وبعد تحديث الصفحة كذلك', shown?.name === 'subjects', shown?.name);
}

console.log('\n' + (bad ? `${bad} فشل` : 'سلوك الرجوع سليم'));
process.exit(bad ? 1 : 0);
