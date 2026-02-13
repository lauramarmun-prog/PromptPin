const CACHE = "promptpin-v7"; // súbelo: v8, v9...
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./idb.js",
  "./manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
