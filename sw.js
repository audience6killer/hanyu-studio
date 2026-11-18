/* HSK5 Studio offline shell.
 * Only same-origin GETs are cached. Supabase sync calls pass straight through.
 */
const CACHE = "hsk5-studio-v5";
const CORE = [
  "./",
  "./index.html",
  "./setup.html",
  "./manifest.webmanifest",
  "./assets/css/app.css",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/js/data/config.js",
  "./assets/js/data/vocab.js",
  "./assets/js/data/lessons.js",
  "./assets/js/data/tap.js",
  "./assets/js/core/util.js",
  "./assets/js/core/data.js",
  "./assets/js/core/storage.js",
  "./assets/js/core/srs.js",
  "./assets/js/core/plan.js",
  "./assets/js/core/tts.js",
  "./assets/js/core/session.js",
  "./assets/js/core/sync.js",
  "./assets/js/ui/components.js",
  "./assets/js/ui/onboarding.js",
  "./assets/js/ui/dashboard.js",
  "./assets/js/ui/session.js",
  "./assets/js/ui/lessons.js",
  "./assets/js/ui/lesson.js",
  "./assets/js/ui/review.js",
  "./assets/js/ui/exam.js",
  "./assets/js/ui/stats.js",
  "./assets/js/ui/settings.js",
  "./assets/js/ui/diagnostic.js",
  "./assets/js/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    const path = url.pathname;
    const target = path.endsWith("/setup.html") ? "./setup.html" : "./index.html";
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(target, copy));
          }
          return res;
        })
        .catch(() => caches.match(target))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});

