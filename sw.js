const CACHE = "promptpin-v9";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./idb.js",
  "./manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("promptpin-v") && k !== CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);

    try {
      const fresh = await fetch(e.request);
      if (fresh && fresh.ok) {
        cache.put(e.request, fresh.clone());
      }
      return fresh;
    } catch {
      const cached = await cache.match(e.request);
      if (cached) return cached;
      throw new Error("Network unavailable and no cached response found.");
    }
  })());
});
