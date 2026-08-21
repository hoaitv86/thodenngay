const CACHE_VERSION = "tdn-app-shell-v2";
const APP_SHELL_URLS = [
  "/",
  "/login",
  "/site.webmanifest",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL_URLS.map((url) => new Request(url, { cache: "reload" }))))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function shouldCacheAsset(requestUrl) {
  return requestUrl.origin === self.location.origin
    && !requestUrl.pathname.startsWith("/api/")
    && (requestUrl.pathname.startsWith("/_next/")
      || requestUrl.pathname.startsWith("/icons/")
      || requestUrl.pathname.endsWith(".css")
      || requestUrl.pathname.endsWith(".js")
      || requestUrl.pathname.endsWith(".png")
      || requestUrl.pathname.endsWith(".jpg")
      || requestUrl.pathname.endsWith(".jpeg")
      || requestUrl.pathname.endsWith(".webp")
      || requestUrl.pathname.endsWith(".svg")
      || requestUrl.pathname.endsWith(".woff2"));
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request))
      || (await cache.match("/login"))
      || (await cache.match("/"))
      || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const refreshed = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || refreshed;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (shouldCacheAsset(requestUrl)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
