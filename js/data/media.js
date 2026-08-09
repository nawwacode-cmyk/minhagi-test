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
  /**
   * سطح الملصق قبل التشغيل — إطارٌ حقيقي من الدرس لا رسمٌ نائب.
   *
   * كل الدروس كانت تعرض الرسم النائب نفسه فتتشابه قبل فتحها. والصورة
   * المخزَّنة (`poster_key`) لا توجد إلّا لما رُفع بعد إضافتها — وإصلاحٌ
   * يشترط إعادة رفع كل درس ليس إصلاحًا.
   *
   * فإن غابت الصورة نستعمل الفيديو نفسه سطحًا: `#t=3` تجعل المتصفّح يطلب
   * أوّل بايتات الملفّ ويعرض إطار الثانية الثالثة — بلا تنزيل المقطع كلّه
   * وبلا رفعٍ جديد. والنداء يُدفئ ذاكرة الروابط أيضًا، فيبدأ التشغيل فورًا
   * عند الضغط بدل جولة توقيع جديدة.
   *
   * يُرجع null بلا إنترنت أو عند أي فشل: الرسم النائب أفضل من فراغ.
   */
  async function posterFor(videoId) {
    if (!navigator.onLine) return null;
    try {
      const [got] = await fetchUrls([videoId]);
      if (!got) return null;
      if (got.poster) return h('img', { src: got.poster, alt: '', loading: 'lazy' });
      return h('video', {
        src: got.url + '#t=3',
        preload: 'metadata', muted: true, playsinline: true,
        tabindex: -1, 'aria-hidden': 'true',
        disablepictureinpicture: true, disableremoteplayback: true,
      });
    } catch { return null; }
  }

  // ---------------------------------------------------------------------------
  // أدوات التحكّم — بهوية التطبيق لا بشكل المتصفّح
  //
  // المشغّل الافتراضي يختلف بين كروم وسفاري وأندرويد، ولا يفهم RTL (شريط
  // التقدّم يمتلئ من اليسار في واجهة عربية)، ويعرض في بعضها قائمة «تنزيل».
  // وبناؤه هنا يعطي أيضًا ما يحتاجه درسٌ تعليمي تحديدًا: قفزة ١٠ ثوانٍ
  // للمراجعة، وتحكّم بالسرعة (الطالب يبطّئ الشرح الفرنسي أو يسرّع المراجعة).
  // ---------------------------------------------------------------------------
  const two = (n) => String(Math.floor(n)).padStart(2, '0');
  const clock = (s) => {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    return m >= 60 ? `${Math.floor(m / 60)}:${two(m % 60)}:${two(s % 60)}`
                   : `${m}:${two(s % 60)}`;
  };

  const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

  function controls(el, box) {
    const { icon, svg } = UI;

    const playBtn = h('button.vc__btn.vc__btn--play', { 'aria-label': 'تشغيل' }, icon.play(20));
    const back10 = h('button.vc__btn', { 'aria-label': 'إرجاع ١٠ ثوانٍ' },
      svg('<path d="M11 5 6.5 9.2 11 13.4"/><path d="M6.5 9.2h6.9a5.6 5.6 0 1 1 0 11.2H8"/>', 19));
    const fwd10 = h('button.vc__btn', { 'aria-label': 'تقديم ١٠ ثوانٍ' },
      svg('<path d="m13 5 4.5 4.2L13 13.4"/><path d="M17.5 9.2h-6.9a5.6 5.6 0 1 0 0 11.2H16"/>', 19));

    const cur = h('span.vc__t', '0:00');
    const dur = h('span.vc__t', clock(el.duration));

    // شريط التقدّم: `range` أصلي لا div مخصَّص — يعطي السحب واللمس ولوحة
    // المفاتيح مجّانًا، وهي أشياء تُكتب خطأً بسهولة.
    const seek = h('input.vc__seek', { type: 'range', min: 0, max: 1000, value: 0,
                                       'aria-label': 'موضع التشغيل' });
    const buffered = h('div.vc__buf');

    const speed = h('button.vc__btn.vc__btn--txt', { 'aria-label': 'سرعة التشغيل' }, '1×');
    const full = h('button.vc__btn', { 'aria-label': 'ملء الشاشة' },
      svg('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/>'
        + '<path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>', 19));

    // النسبة تُحسب مرّة: `seek.max` قد يتغيّر لو غيّرناه لاحقًا
    const pct = (t) => (el.duration ? (t / el.duration) * 1000 : 0);

    let scrubbing = false;
    const paint = () => {
      if (!scrubbing) seek.value = String(pct(el.currentTime));
      cur.textContent = clock(el.currentTime);
      dur.textContent = clock(el.duration);
      // التعبئة يدوية: `range` لا يلوّن ما قبل الإبهام، و`direction:rtl`
      // وحده يعكس الاتجاه بلا أن يلوّن.
      const p = (Number(seek.value) / 1000) * 100;
      seek.style.setProperty('--p', p + '%');
      try {
        const b = el.buffered.length ? el.buffered.end(el.buffered.length - 1) : 0;
        buffered.style.width = (el.duration ? (b / el.duration) * 100 : 0) + '%';
      } catch { /* buffered قد يرمي قبل التحميل */ }
    };

    const setIcon = () => {
      playBtn.replaceChildren(el.paused
        ? icon.play(20)
        : svg('<rect x="7" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>'
            + '<rect x="13.4" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>', 20));
      playBtn.setAttribute('aria-label', el.paused ? 'تشغيل' : 'إيقاف مؤقّت');
      box.classList.toggle('is-playing', !el.paused);
    };

    const toggle = () => (el.paused ? el.play().catch(() => {}) : el.pause());
    playBtn.addEventListener('click', toggle);
    back10.addEventListener('click', () => { el.currentTime = Math.max(0, el.currentTime - 10); });
    fwd10.addEventListener('click', () => { el.currentTime = Math.min(el.duration || 0, el.currentTime + 10); });

    speed.addEventListener('click', () => {
      const next = SPEEDS[(SPEEDS.indexOf(el.playbackRate) + 1) % SPEEDS.length] ?? 1;
      el.playbackRate = next;
      speed.textContent = (next === 1 ? '1' : String(next)) + '×';
    });

    full.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      // على iOS لا fullscreen للعناصر — للفيديو وحده واجهة خاصّة
      else if (box.requestFullscreen) box.requestFullscreen().catch(() => {});
      else el.webkitEnterFullscreen?.();
    });

    seek.addEventListener('input', () => {
      scrubbing = true;
      cur.textContent = clock((Number(seek.value) / 1000) * (el.duration || 0));
      seek.style.setProperty('--p', (Number(seek.value) / 10) + '%');
    });
    const commitSeek = () => {
      if (!scrubbing) return;
      scrubbing = false;
      if (el.duration) el.currentTime = (Number(seek.value) / 1000) * el.duration;
    };
    seek.addEventListener('change', commitSeek);

    el.addEventListener('timeupdate', paint);
    el.addEventListener('progress', paint);
    el.addEventListener('loadedmetadata', paint);
    el.addEventListener('play', setIcon);
    el.addEventListener('pause', setIcon);
    el.addEventListener('ended', setIcon);

    // النقر على الفيديو نفسه يشغّل ويوقف — سلوك متوقّع لا يحتاج تعليمًا
    el.addEventListener('click', toggle);

    /* لوحة المفاتيح على الحاسوب. `preventDefault` للمسافة تحديدًا: بدونه
       تُمرّر الصفحة تحت المشغّل بينما يظنّ المستخدم أنه أوقف الفيديو. */
    box.tabIndex = 0;
    box.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
      // في RTL يبقى معنى السهمين زمنيًّا كما هو عالميًّا: يمين = تقدّم
      else if (e.key === 'ArrowRight') el.currentTime = Math.min(el.duration || 0, el.currentTime + 5);
      else if (e.key === 'ArrowLeft') el.currentTime = Math.max(0, el.currentTime - 5);
      else if (e.key === 'f') full.click();
    });

    setIcon();
    paint();

    return h('div.vc',
      h('div.vc__bar',
        h('div.vc__track', buffered, seek)),
      h('div.vc__row',
        playBtn, back10, fwd10,
        h('span.vc__time', cur, h('span.vc__sep', '/'), dur),
        h('span.vc__grow'),
        speed, full));
  }

  /* آخر مشغّل بُني. العلامة المائية تُشغّل مؤقّتًا كل ٢٠ ثانية يُنظَّف
     بـ`_dispose`، ولا شيء في التطبيق يستدعيها — فكل درس يُفتح كان يترك
     مؤقّتًا يعمل إلى الأبد. والتطبيق لا يشغّل أكثر من فيديو واحد في وقت
     واحد، فتنظيفُ السابق عند بناء التالي يحصر التسريب في صفر. */
  let live = null;

  async function player(videoId, { local } = {}) {
    try { live?._dispose?.(); } catch { /* لا يمنع بناء الجديد */ }
    live = null;

    const box = h('div.video');
    let meta = null;

    if (!local) {
      const [got] = await fetchUrls([videoId]);
      if (!got) throw new Error('الفيديو غير متاح.');
      meta = got;
    }

    const el = h('video', {
      src: local || meta.url,
      poster: meta?.poster || undefined,
      playsinline: true,
      // `controls: false` عمدًا: نبني أدواتنا أدناه. المشغّل الافتراضي يختلف
      // شكلًا وسلوكًا بين كروم وسفاري وأندرويد، ولا يعرف RTL، ويعرض قائمة
      // «تنزيل» في بعضها.
      preload: 'metadata',
      controlslist: 'nodownload noplaybackrate noremoteplayback',
      disablepictureinpicture: true,
      // يزيل زرّ البثّ (Chromecast) الذي يحقنه كروم فوق الفيديو: مربّع رمادي
      // كبير في الزاوية يحجب الصورة، ولا معنى لبثّ درسٍ محميٍّ برابط موقّع
      // إلى شاشة أخرى أصلًا.
      disableremoteplayback: true,
      oncontextmenu: (e) => e.preventDefault(),
    });

    el.addEventListener('play',  () => secureScreen(true));
    el.addEventListener('pause', () => secureScreen(false));
    el.addEventListener('ended', () => secureScreen(false));

    /* --- قياس التقطيع --------------------------------------------------------
       قرار «هل نحتاج جودات متعدّدة؟» يجب أن يُبنى على أرقام لا على تخمين،
       والطالب لا يشتكي غالبًا — يغلق التطبيق. فنقيس ما يقع فعلًا: كم مرّة
       توقّف الفيديو للتخزين المؤقّت، وكم استغرق قبل أن يبدأ.

       يُرسل مرّة واحدة لكل مشاهدة وعند تجاوز حدٍّ يستحقّ الانتباه فقط —
       تسجيلُ كل مشاهدة سليمة ضجيجٌ يغرق ما يهمّ. ويمرّ عبر مُبلِّغ الأعطال
       نفسه: لا بنية ثانية لأجل قياس واحد. */
    let stalls = 0, reported = false;
    const t0 = Date.now();
    let firstPlayAt = null;

    el.addEventListener('waiting', () => { stalls++; });
    el.addEventListener('playing', () => { firstPlayAt ??= Date.now(); });

    const reportIfRough = () => {
      if (reported) return;
      const startMs = firstPlayAt ? firstPlayAt - t0 : null;
      // ثلاث توقّفات أو أكثر، أو بدءٌ يتجاوز ثماني ثوانٍ: مشاهدةٌ سيّئة فعلًا
      if (stalls < 3 && !(startMs && startMs > 8000)) return;
      reported = true;
      // المعرّف في الرسالة عمدًا: المُبلِّغ يكرّر الرسالة مرّة واحدة للجلسة،
      // فبلا تمييز يُقاس أوّل درس متقطّع وحده وتضيع بقيّة الدروس.
      window.Report?.send('video', `مشاهدة متقطّعة · ${videoId}`, null, {
        stalls, start_ms: startMs,
        duration_s: Math.round(el.duration || 0),
        watched_s: Math.round(el.currentTime || 0),
        // نوع الشبكة إن أتاحه المتصفّح — يفرّق بين «شبكتنا بطيئة» و«ملفّنا ثقيل»
        net: navigator.connection?.effectiveType ?? null,
      });
    };
    el.addEventListener('pause', reportIfRough);
    el.addEventListener('ended', reportIfRough);

    box.append(el,
      watermarkLayer(meta?.watermark || Store.get().username || 'مشترك'),
      controls(el, box));

    // تنظيف المؤقّت عند إزالة المشغّل من الصفحة
    box._dispose = () => {
      const layer = box.querySelector('.wm');
      if (layer?._timer) clearInterval(layer._timer);
      try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* لا شيء */ }
      secureScreen(false);
    };
    live = box;
    return box;
  }

  return { fetchUrls, posterFor, player, watermarkLayer, secureScreen };
})();
