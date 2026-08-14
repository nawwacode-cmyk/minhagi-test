/* =============================================================================
   report.js — تبليغ أعطال التطبيق

   قبل هذا الملفّ لم يكن في التطبيق أي تسجيل أخطاء: ثلاثة `catch` في app.js
   تبتلع أخطر الأعطال (فشل الرسم الأول، فشل بدء المزامنة) إلى `console.error`
   لا يقرؤه أحد. فالعطل يُعرف حين يشتكي طالب — إن اشتكى — لا قبله.

   ثلاثة شروط لا تُكسر، وكلّها أهمّ من التبليغ نفسه:

   ١. **لا يعطّل الواجهة أبدًا.** كل نداء هنا محاط بـtry، ولا شيء ينتظره.
      طالبٌ يدرس بلا إنترنت يجب ألّا يشعر بوجود هذا الملفّ إطلاقًا.

   ٢. **لا يُبلّغ عن نفسه.** خطأٌ داخل المُبلِّغ يستدعي المُبلِّغ فيخطئ
      فيستدعي نفسه — حلقة تُغرق الجهاز والقاعدة معًا. `sending` يقطعها.

   ٣. **يسقط صامتًا بلا إنترنت.** التطبيق offline-first: انقطاع الشبكة
      حالته الطبيعية لا استثناء، وتقريرٌ يفشل ليس عطلًا يستحقّ الإبلاغ.

   ويُكرِّر نفسه: نفس الرسالة تُرسَل مرّة واحدة في الجلسة. عطلٌ في حلقة رسم
   يُنتج مئات النسخ في ثوانٍ، والمئة لا تقول أكثر ممّا تقوله الأولى.
   ============================================================================= */
window.Report = (function () {
  /* نسخة التطبيق: تُرسل مع كل تقرير لأن السؤال الأول عن أي عطل هو «أي نسخة».
     مُكرَّرة عمدًا هنا وفي `sw.js` — الصفحة لا تصل إلى ثابت داخل الـservice
     worker، وسؤاله بـpostMessage غير متاح عند أول تحميل ولا على file://.
     وحارسٌ في test/smoke.js يُسقط الفحص إن اختلف الرقمان، فلا ينحرفان. */
  const APP_VERSION = 'v76';

  const seen = new Set();
  let sending = false;

  /** اسم الشاشة الحالية — أهمّ سياق: عطلٌ في «الدرس» غير عطلٍ في «الرئيسية». */
  function screenName() {
    try { return (window.App && App.currentName && App.currentName()) || null; }
    catch { return null; }
  }

  async function send(kind, message, stack, meta) {
    // الشروط الثلاثة، بالترتيب الأرخص أوّلًا
    if (sending) return;                                   // لا حلقة
    if (!navigator.onLine) return;                         // أوفلاين: صامت
    if (!window.Api || !Api.isSignedIn || !Api.isSignedIn()) return;

    const text = String(message ?? '').slice(0, 500);
    if (!text) return;
    if (seen.has(text)) return;                            // مرّة واحدة للجلسة
    seen.add(text);

    sending = true;
    try {
      await Api.invoke('report-error', {
        kind, message: text,
        stack: stack ? String(stack).slice(0, 4000) : null,
        screen: screenName(),
        app_version: APP_VERSION,
        meta: meta || {},
      });
    } catch {
      /* فشل التبليغ يُبتلع عمدًا: لا شيء نفعله به، ورميُه هنا يوقظ
         `unhandledrejection` أدناه فيُبلّغ عن فشل التبليغ — وهي الحلقة
         نفسها التي يمنعها `sending`، لكن الابتلاع أوضح وأرخص. */
    } finally {
      sending = false;
    }
  }

  /** يُستدعى من `catch` الصريحة في app.js — الأعطال التي كانت تُبتلع. */
  function capture(where, err) {
    try {
      send('boot', `${where}: ${err && err.message ? err.message : err}`,
           err && err.stack, { where });
    } catch { /* لا شيء */ }
  }

  function install() {
    try {
      window.addEventListener('error', (e) => {
        // أخطاء تحميل الموارد (صورة مفقودة) تصل هنا بلا `error` object —
        // ضجيجٌ لا يفيد التشخيص، ويكفي عنه فحصُ الشبكة.
        if (!e || !e.error) return;
        send('error', e.message, e.error.stack,
             { file: e.filename, line: e.lineno, col: e.colno });
      });

      window.addEventListener('unhandledrejection', (e) => {
        const r = e && e.reason;
        send('unhandledrejection',
             r && r.message ? r.message : String(r),
             r && r.stack ? r.stack : null);
      });
    } catch { /* بيئة بلا addEventListener (الاختبارات) — لا شيء */ }
  }

  return { install, capture, send, APP_VERSION };
})();
