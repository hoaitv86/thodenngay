const CACHE_VERSION = "tdn-app-shell-v7";
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
const WORKER_DYNAMIC_NAVIGATION_FALLBACKS = [
  { pattern: /^\/worker\/history\/[^/]+$/, shell: "/worker/history/__offline-shell__", fallback: "/worker/history" },
  { pattern: /^\/worker\/inventory\/[^/]+\/edit$/, shell: "/worker/inventory/__offline-shell__/edit", fallback: "/worker/inventory" },
  { pattern: /^\/worker\/inventory\/[^/]+\/delete$/, shell: "/worker/inventory/__offline-shell__/delete", fallback: "/worker/inventory" },
  { pattern: /^\/worker\/customers\/[^/]+$/, fallback: "/worker/customers" },
  { pattern: /^\/worker\/jobs\/[^/]+$/, fallback: "/worker/jobs" },
  { pattern: /^\/worker\/billgo\/[^/]+$/, fallback: "/worker/billgo" }
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cacheUrlBatch(cache, PRECACHE_URLS))
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
    caches.open(CACHE_VERSION).then((cache) => cacheUrlBatch(cache, event.data.urls))
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

function getWorkerNavigationFallbacks(pathname) {
  const fallbacks = [];
  const matched = WORKER_DYNAMIC_NAVIGATION_FALLBACKS.find((item) => item.pattern.test(pathname));
  if (matched?.shell) fallbacks.push(matched.shell);
  if (matched?.fallback) fallbacks.push(matched.fallback);
  if (pathname === "/worker" || pathname.startsWith("/worker/")) fallbacks.push("/worker");
  return [...new Set(fallbacks)];
}

function normalizeCacheUrls(urls) {
  const normalized = new Set();
  for (const url of urls) {
    try {
      const requestUrl = new URL(url, self.location.origin);
      if (shouldHandleRequest(requestUrl)) normalized.add(requestUrl.href);
    } catch {
      // Ignore malformed warm-cache URLs.
    }
  }
  return Array.from(normalized);
}

async function matchAny(cache, paths) {
  for (const path of paths) {
    const matched = await cache.match(path, { ignoreSearch: true });
    if (matched) return matched;
  }
  return null;
}

async function matchCachedUrl(cache, requestUrl, request) {
  return (request ? await cache.match(request, { ignoreSearch: false }) : null)
    || await cache.match(requestUrl.href, { ignoreSearch: false })
    || await cache.match(requestUrl.pathname + requestUrl.search, { ignoreSearch: false })
    || await cache.match(requestUrl.pathname, { ignoreSearch: true });
}

async function warmHtmlAssets(cache, response, options = {}) {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return;

    const html = await response.text();
    const assets = new Set();
    const skipUrls = options.skipUrls || new Set();
    const warmedUrls = options.warmedUrls || new Set();
    const attributePattern = /\b(?:src|href)=["']([^"']+)["']/g;
    let match;
    while ((match = attributePattern.exec(html))) {
      try {
        const assetUrl = new URL(match[1], self.location.origin);
        if (!shouldCacheAsset(assetUrl)) continue;
        if (skipUrls.has(assetUrl.href) || warmedUrls.has(assetUrl.href)) continue;
        if (await matchCachedUrl(cache, assetUrl)) continue;
        warmedUrls.add(assetUrl.href);
        assets.add(assetUrl.href);
      } catch {
        // Ignore malformed HTML attributes.
      }
    }

    await Promise.all(Array.from(assets).map((url) => cacheUrl(cache, url, { skipHtmlAssets: true, skipUrls, warmedUrls })));
  } catch {
    // Route HTML is still useful even if linked assets cannot be warmed.
  }
}

async function putAppShell(cache, request, response, options = {}) {
  const requestUrl = new URL(request.url);
  await cache.put(request, response.clone());
  await cache.put(requestUrl.pathname + requestUrl.search, response.clone());
  if (options.warmAssets !== false) {
    await warmHtmlAssets(cache, response.clone(), options);
  }
  console.info("[TDN-OFFLINE]", "app shell saved", { route: requestUrl.pathname });
}

async function cacheUrlBatch(cache, urls) {
  const normalizedUrls = normalizeCacheUrls(urls);
  const directAssetUrls = new Set(
    normalizedUrls.filter((url) => {
      try {
        return shouldCacheAsset(new URL(url));
      } catch {
        return false;
      }
    })
  );
  const warmedUrls = new Set(directAssetUrls);
  await Promise.all(normalizedUrls.map((url) => cacheUrl(cache, url, { skipUrls: directAssetUrls, warmedUrls })));
}

async function cacheUrl(cache, url, options = {}) {
  try {
    const requestUrl = new URL(url, self.location.origin);
    if (!shouldHandleRequest(requestUrl)) return;

    const isAsset = shouldCacheAsset(requestUrl);
    const cached = isAsset ? await matchCachedUrl(cache, requestUrl) : null;
    if (cached) return;

    const request = new Request(requestUrl.href, { cache: isAsset ? "default" : "reload", credentials: "same-origin" });
    const response = await fetch(request);
    if (!response || !response.ok) return;

    await putAppShell(cache, request, response, {
      ...options,
      warmAssets: !isAsset && options.skipHtmlAssets !== true,
    });
  } catch {
    // Best-effort warm cache: one failed file must not abort offline readiness.
  }
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  const requestUrl = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response && response.ok) await putAppShell(cache, request, response.clone(), { warmAssets: false });
    return response;
  } catch {
    const directMatch = (await cache.match(request))
      || (await cache.match(requestUrl.pathname, { ignoreSearch: true }));
    if (directMatch) return directMatch;

    const workerShellMatch = await matchAny(cache, getWorkerNavigationFallbacks(requestUrl.pathname));
    if (workerShellMatch) return workerShellMatch;

    if (requestUrl.pathname === "/worker" || requestUrl.pathname.startsWith("/worker/")) {
      return (await cache.match("/worker", { ignoreSearch: true }))
        || (await cache.match("/", { ignoreSearch: true }))
        || Response.error();
    }

    return (await cache.match(APP_SHELL_FALLBACK_URL, { ignoreSearch: true }))
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
