// 달력 PWA 서비스워커 — 항상 최신(네트워크) 우선, 오프라인일 때만 캐시
const CACHE = "calendar-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./sync.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 네트워크 우선 + HTTP 캐시 우회(no-store): 온라인이면 항상 최신을 받아온다.
// 실패(오프라인)일 때만 캐시에서 꺼냄.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith((async () => {
    try {
      const fresh = await fetch(e.request, { cache: "no-store" });
      const cache = await caches.open(CACHE);
      cache.put(e.request, fresh.clone()).catch(() => {});
      return fresh;
    } catch (err) {
      const cached = await caches.match(e.request);
      return cached || caches.match("./index.html");
    }
  })());
});
