/* LTM service worker: keeps the app working offline.
   Bump CACHE with each release (it matches the version in index.html) so phones pick up the new files. */
const CACHE = "ltm-v3.1";
const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png",
  "fonts/fonts.css",
  "fonts/silkscreen-latin-400-normal.woff2", "fonts/silkscreen-latin-700-normal.woff2",
  "fonts/nunito-latin-wght-normal.woff2", "fonts/nunito-latin-ext-wght-normal.woff2", "fonts/nunito-cyrillic-wght-normal.woff2",
  "fonts/noto-serif-hebrew-hebrew-700-normal.woff2"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("ltm-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// The page itself: network first (so updates arrive), cache when offline or slow.
async function page(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req.url, { cache: "no-cache" }), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 6000))]);
    if (res && res.ok) { cache.put(req.url, res.clone()); cache.put(new URL("index.html", self.registration.scope).href, res.clone()); }
    return res;
  } catch (err) {
    return (await cache.match(req.url, { ignoreSearch: true })) || (await cache.match(new URL("index.html", self.registration.scope).href)) || Response.error();
  }
}
// Icons and fonts: use the saved copy, refresh it quietly in the background.
async function asset(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || new Response("", { status: 504 });
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                 // GitHub, Apps Script, Toggl: never touched
  if (req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) e.respondWith(page(req));
  else e.respondWith(asset(req));
});
