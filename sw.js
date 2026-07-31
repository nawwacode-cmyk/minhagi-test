/* =============================================================================
   sw.js — service worker
   يخزّن **هيكل التطبيق فقط**: HTML و CSS و JS والرسوم.
   المحتوى الدراسي وتقدّم الطالب لا يمرّان من هنا إطلاقًا — مكانهما قاعدة
   البيانات المحلية. الخلط بينهما يُنشئ مصدرَي حقيقة يتعارضان.
   ============================================================================= */

const VERSION = 'manhaji-shell-v1';

const SHELL = [
  './', './index.html',
  './css/tokens.css', './css/app.css',
  './js/ui.js', './js/data/seed.js', './js/store.js', './js/components.js',
  './js/screens/onboarding.js', './js/screens/main.js',
  './js/screens/course.js', './js/screens/exam.js', './js/app.js',
  './assets/img/welcome.jpg', './assets/img/cover-fr.jpg',
  './assets/img/video-thumb.svg', './assets/img/empty-download.svg',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/fonts/Alexandria-400.woff2',
  './assets/fonts/Alexandria-600.ttf',
  './assets/fonts/Alexandria-700.woff2',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // addAll يفشل كليًا إن سقط ملف واحد؛ نضيف كلًّا على حدة حتى لا يتعطّل
      // التثبيت بسبب أصل واحد مفقود (خط لم يُنزَّل مثلًا).
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

  // الهيكل: من الكاش أولًا. التطبيق يجب أن يقلع فورًا بلا شبكة — هذه هي
  // الحالة الطبيعية المتوقّعة لا الاستثناء.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
