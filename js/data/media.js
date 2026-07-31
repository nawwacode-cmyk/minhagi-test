/* =============================================================================
   media.js — طبقة الفيديو: روابط موقّعة · علامة مائية · منع التقاط الشاشة

   الحماية هنا **ردع لا منع**. أي فيديو يستطيع الطالب مشاهدته يستطيع تصويره
   بهاتف ثانٍ، ولا شيء يمنع ذلك. الهدف أن تكون القرصنة أصعب وأبطأ وأكثر خطرًا
   على فاعلها من شراء كود بسعره.
   ============================================================================= */
window.Media = (function () {
  const { h } = UI;

  /** الروابط تعيش ١٠ دقائق على السيرفر؛ نجدّدها قبل ذلك بهامش أمان. */
  const REFRESH_BEFORE_MS = 90_000;

  const cache = new Map();   // videoId → { url, expiresAt, watermark }

  // ---------------------------------------------------------------------------
  // ١. الروابط الموقّعة
  // ---------------------------------------------------------------------------

  /**
   * يجلب روابط موقّعة لفيديوهات محدّدة.
   * يمرّر بصمة الجهاز: السيرفر يرفض الطلب من جهاز غير مرتبط حتى لو كان
   * توكن الجلسة صحيحًا — فنسخ التوكن وحده لا يكفي لتشغيل الفيديو.
   */
  async function fetchUrls(videoIds) {
    const need = videoIds.filter((id) => {
      const hit = cache.get(id);
      return !hit || hit.expiresAt - Date.now() < REFRESH_BEFORE_MS;
    });

    if (need.length) {
      const res = await Api.invoke('media-url', {
        video_ids: need,
        fingerprint: await Device.fingerprint(),
      });
      if (!res.ok) throw new Error(res.message || 'تعذّر تجهيز الفيديو.');

      const expiresAt = Date.now() + res.expires_in * 1000;
      for (const u of res.urls) {
        cache.set(u.video_id, { ...u, expiresAt, watermark: res.watermark });
      }
    }

    return videoIds.map((id) => cache.get(id)).filter(Boolean);
  }

  // ---------------------------------------------------------------------------
  // ٢. العلامة المائية
  // ---------------------------------------------------------------------------

  /**
   * طبقة نصّية فوق الفيديو تحمل اسم الطالب.
   *
   * لا تمنع تسجيل الشاشة — بل هذا بالضبط دورها: التسجيل يلتقطها معه، فيصبح
   * المسرِّب معروفًا بالاسم. تحويل النشر من فعل مجهول إلى مخاطرة شخصية أوقف
   * تسريب دورات كثيرة بكلفة أقل بكثير من أي تشفير.
   *
   * تتحرّك ببطء بين المواضع حتى لا يمكن قصّها بإطار ثابت.
   */
  function watermarkLayer(text) {
    const layer = h('div.wm', { 'aria-hidden': 'true' },
      h('span.wm__t', { text: `${text} · منهاجي` }));

    // تنقّل كل ٢٠ ثانية بين تسعة مواضع
    let i = 0;
    const spots = [
      ['8%', '6%'], ['8%', '46%'], ['8%', '86%'],
      ['46%', '6%'], ['46%', '46%'], ['46%', '86%'],
      ['84%', '6%'], ['84%', '46%'], ['84%', '86%'],
    ];
    const move = () => {
      const [top, left] = spots[i++ % spots.length];
      const t = layer.firstChild;
      t.style.top = top;
      t.style.insetInlineStart = left;
    };
    move();
    layer._timer = setInterval(move, 20_000);
    return layer;
  }

  // ---------------------------------------------------------------------------
  // ٣. منع التقاط الشاشة (أندرويد)
  // ---------------------------------------------------------------------------

  /**
   * FLAG_SECURE يجعل نافذة التطبيق سوداء في أي لقطة أو تسجيل شاشة على أندرويد.
   * يُفعَّل أثناء تشغيل الفيديو فقط لا طوال الوقت: تفعيله دائمًا يمنع الطالب
   * من تصوير سؤال ليسأل عنه صديقه — وهذا استعمال مشروع لا نريد منعه.
   *
   * يعمل في نسخة Capacitor فقط؛ على الويب لا وجود له ونتجاهله بصمت.
   */
  async function secureScreen(on) {
    try {
      const p = window.Capacitor?.Plugins?.PrivacyScreen;
      if (!p) return false;
      on ? await p.enable() : await p.disable();
      return true;
    } catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // ٤. المشغّل
  // ---------------------------------------------------------------------------

  /**
   * يبني عنصر فيديو محميًا.
   * `local` مسار ملف منزَّل مسبقًا؛ إن وُجد لا نلمس الشبكة إطلاقًا.
   */
  async function player(videoId, { local } = {}) {
    const box = h('div.video');
    let meta = null;

    if (!local) {
      const [got] = await fetchUrls([videoId]);
      if (!got) throw new Error('الفيديو غير متاح.');
      meta = got;
    }

    const el = h('video', {
      src: local || meta.url,
      playsinline: true,
      controls: true,
      preload: 'metadata',
      // يمنع قائمة «تنزيل» في مشغّل كروم — عائق أمام النسخ العابر لا أكثر
      controlslist: 'nodownload noplaybackrate',
      disablepictureinpicture: true,
      oncontextmenu: (e) => e.preventDefault(),
    });

    el.addEventListener('play',  () => secureScreen(true));
    el.addEventListener('pause', () => secureScreen(false));
    el.addEventListener('ended', () => secureScreen(false));

    box.append(el, watermarkLayer(meta?.watermark || Store.get().username || 'مشترك'));

    // تنظيف المؤقّت عند إزالة المشغّل من الصفحة
    box._dispose = () => {
      const layer = box.querySelector('.wm');
      if (layer?._timer) clearInterval(layer._timer);
      secureScreen(false);
    };
    return box;
  }

  return { fetchUrls, player, watermarkLayer, secureScreen };
})();
