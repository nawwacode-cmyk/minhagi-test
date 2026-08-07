/* =============================================================================
   sw.js — service worker
   يخزّن **هيكل التطبيق فقط**: HTML و CSS و JS والرسوم.
   المحتوى الدراسي وتقدّم الطالب لا يمرّان من هنا إطلاقًا — مكانهما قاعدة
   البيانات المحلية. الخلط بينهما يُنشئ مصدرَي حقيقة يتعارضان.

   ⚠️ عند كل إصدار: **ارفع رقم VERSION**. النسخة القديمة تبقى مخدومة من الكاش
   إلى الأبد ما لم يتغيّر هذا السطر، فيرى الطالب تطبيقًا قديمًا رغم النشر.
   ============================================================================= */

const VERSION = 'manhaji-shell-v25';

const SHELL = [
  './', './index.html',
  './css/tokens.css', './css/app.css',
  './js/ui.js', './js/data/blobstore.js', './js/data/seed.js', './js/store.js', './js/components.js',
  './js/data/api.js', './js/data/device.js', './js/data/sync.js', './js/data/media.js',
  './js/screens/onboarding.js', './js/screens/evicted.js', './js/screens/progress.js',
  './js/screens/main.js', './js/screens/course.js', './js/screens/exam.js', './js/app.js',
  './assets/img/cover-fr.jpg',
  './assets/img/video-thumb.svg', './assets/img/empty-download.svg',
  './assets/img/icon-192.png', './assets/img/icon-512.png',
  './assets/img/icon-maskable-512.png',
  './assets/fonts/Alexandria-400.woff2',
  './assets/fonts/Alexandria-600.ttf',
  './assets/fonts/Alexandria-700.woff2',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // addAll يفشل كليًا إن سقط ملف واحد؛ نضيف كلًّا على حدة حتى لا يتعطّل
      // التثبيت بسبب أصل واحد مفقود.
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  /* -----------------------------------------------------------------------
     stale-while-revalidate بدل cache-first.

     الفرق جوهري: cache-first يخدم القديم **إلى الأبد** ما لم يتغيّر VERSION —
     وهو ما جعل نسخة منشورة لا تصل إلى المتصفح إطلاقًا. أما هذه فتخدم من الكاش
     فورًا (فيقلع التطبيق بلا انتظار شبكة، وهو المطلوب) وتحدّث النسخة في
     الخلفية، فيرى المستخدم الجديد عند إعادة الفتح التالية.

     أي: تأخّر تحديثٍ واحد بدل تعطّل التحديث نهائيًا.
  ----------------------------------------------------------------------- */
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req);

      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      // بلا كاش: ننتظر الشبكة، ونسقط إلى الصفحة الرئيسية لطلبات التنقّل
      if (!cached) {
        const res = await network;
        if (res) return res;
        return req.mode === 'navigate'
          ? (await cache.match('./index.html')) || Response.error()
          : Response.error();
      }

      return cached;
    }),
  );
});
