/* =============================================================================
   device.js — بصمة الجهاز

   هذه البصمة هي ما يمنع تداول الكود بين الطلاب: الاشتراك يُربط بها، والسيرفر
   يرفض أي طلب فيديو أو تفعيل من بصمة أخرى.

   على الويب لا توجد بصمة حقيقية، فنولّد معرّفًا عشوائيًا ونحفظه محليًا. هو
   «بصمة متصفح» لا بصمة جهاز: مسح بيانات الموقع يعيد التصفير. مقبول للتجربة،
   وغير كافٍ للإنتاج.

   في نسخة Capacitor نستعمل @capacitor/device الذي يعطي معرّفًا ثابتًا لا
   يتغيّر إلا بإعادة ضبط الجهاز — وهو ما يجعل النموذج الأمني فعّالًا فعلًا.
   ============================================================================= */
window.Device = (function () {

  const KEY = 'manhaji.device.v1';

  let cached = null;

  async function fingerprint() {
    if (cached) return cached;

    // Capacitor: معرّف ثابت من نظام التشغيل
    try {
      const native = window.Capacitor?.Plugins?.Device;
      if (native) {
        const { identifier } = await native.getId();
        if (identifier) return (cached = `cap:${identifier}`);
      }
    } catch { /* نتابع إلى بديل الويب */ }

    // الويب: معرّف عشوائي ثابت ما دامت بيانات الموقع باقية
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = 'web:' + crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return (cached = id);
  }

  /** اسم مقروء يظهر في «الأجهزة المرتبطة» ولوحة الأدمن. */
  function label() {
    const ua = navigator.userAgent || '';
    const os = /Android/i.test(ua) ? 'Android'
             : /iPhone|iPad/i.test(ua) ? 'iPhone / iPad'
             : /Windows/i.test(ua) ? 'Windows'
             : /Mac/i.test(ua) ? 'Mac'
             : /Linux/i.test(ua) ? 'Linux' : 'جهاز';
    return `هذا الجهاز — ${os}`;
  }

  const platform = () => window.Capacitor?.getPlatform?.() || 'web';

  return { fingerprint, label, platform };
})();
