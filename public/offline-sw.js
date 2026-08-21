const CACHE_VERSION = "tdn-app-shell-v3";
const APP_SHELL_FALLBACK_URL = "/login";
const PRECACHE_URLS = [
  "/",
  APP_SHELL_FALLBACK_URL,
  "/site.webmanifest",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png"
];
const CACHE_APP_SHELL_MESSAGE = "TDN_CACHE_APP_SHELL";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.all(PRECACHE_URLS.map((url) => cacheUrl(cache, url))))
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

self.addEventListener("message", (event) => {
  if (event.data?.type !== CACHE_APP_SHELL_MESSAGE || !Array.isArray(event.data.urls)) return;

  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(event.data.urls.map((url) => cacheUrl(cache, url)))
    )
  );
});

function isSameOriginUrl(url) {
  return url.origin === self.location.origin;
}

function shouldHandleRequest(requestUrl) {
  return isSameOriginUrl(requestUrl) && !requestUrl.pathname.startsWith("/api/");
}

function shouldCacheAsset(requestUrl) {
  return shouldHandleRequest(requestUrl)
    && (requestUrl.pathname.startsWith("/_next/")
      || requestUrl.pathname.startsWith("/icons/")
      || requestUrl.pathname.endsWith(".css")
      || requestUrl.pathname.endsWith(".js")
      || requestUrl.pathname.endsWith(".png")
      || requestUrl.pathname.endsWith(".ico")
      || requestUrl.pathname.endsWith(".jpg")
      || requestUrl.pathname.endsWith(".jpeg")
      || requestUrl.pathname.endsWith(".webp")
      || requestUrl.pathname.endsWith(".svg")
      || requestUrl.pathname.endsWith(".woff")
      || requestUrl.pathname.endsWith(".woff2")
      || requestUrl.pathname.endsWith(".json")
      || requestUrl.pathname.endsWith(".webmanifest"));
}

async function cacheUrl(cache, url) {
  try {
    const requestUrl = new URL(url, self.location.origin);
    if (!shouldHandleRequest(requestUrl)) return;

    const request = new Request(requestUrl.href, { cache: "reload", credentials: "same-origin" });
    const response = await fetch(request);
    if (!response || !response.ok) return;

    await cache.put(request, response.clone());
    await cache.put(requestUrl.pathname + requestUrl.search, response.clone());
  } catch {
    // Best-effort warm cache: one failed file must not abort offline readiness.
  }
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request))
      || (await cache.match(new URL(request.url).pathname, { ignoreSearch: true }))
      || (await cache.match(APP_SHELL_FALLBACK_URL, { ignoreSearch: true }))
      || (await cache.match("/", { ignoreSearch: true }))
      || Response.error();
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: false })
    || await cache.match(new URL(request.url).pathname, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
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
  if (!shouldHandleRequest(requestUrl)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (requestUrl.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }

  if (shouldCacheAsset(requestUrl)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
