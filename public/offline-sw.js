const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const IS_LOCAL_DEV_HOST = LOCAL_DEV_HOSTS.has(self.location.hostname);
const CACHE_VERSION = "tdn-app-shell-v8";
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
const REFRESH_DEPLOY_CACHE_MESSAGE = "TDN_REFRESH_DEPLOY_CACHE";
const WORKER_DYNAMIC_NAVIGATION_FALLBACKS = [
  { pattern: /^\/worker\/history\/[^/]+$/, shell: "/worker/history/__offline-shell__", fallback: "/worker/history" },
  { pattern: /^\/worker\/inventory\/[^/]+\/edit$/, shell: "/worker/inventory/__offline-shell__/edit", fallback: "/worker/inventory" },
  { pattern: /^\/worker\/inventory\/[^/]+\/delete$/, shell: "/worker/inventory/__offline-shell__/delete", fallback: "/worker/inventory" },
  { pattern: /^\/worker\/customers\/[^/]+$/, fallback: "/worker/customers" },
  { pattern: /^\/worker\/jobs\/[^/]+$/, fallback: "/worker/jobs" },
  { pattern: /^\/worker\/billgo\/[^/]+$/, fallback: "/worker/billgo" }
];

self.addEventListener("install", (event) => {
  if (IS_LOCAL_DEV_HOST) {
    event.waitUntil(self.skipWaiting());
    return;
  }

  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cacheUrlBatch(cache, PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  if (IS_LOCAL_DEV_HOST) {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith("tdn-")).map((key) => caches.delete(key))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    );
    return;
  }

  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (IS_LOCAL_DEV_HOST) return;
  if (![CACHE_APP_SHELL_MESSAGE, REFRESH_DEPLOY_CACHE_MESSAGE].includes(event.data?.type) || !Array.isArray(event.data.urls)) return;

  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cacheUrlBatch(cache, event.data.urls, {
      force: event.data.type === REFRESH_DEPLOY_CACHE_MESSAGE,
    }))
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

async function cacheUrlBatch(cache, urls, options = {}) {
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
  await Promise.all(normalizedUrls.map((url) => cacheUrl(cache, url, { ...options, skipUrls: directAssetUrls, warmedUrls })));
}

async function cacheUrl(cache, url, options = {}) {
  try {
    const requestUrl = new URL(url, self.location.origin);
    if (!shouldHandleRequest(requestUrl)) return;

    const isAsset = shouldCacheAsset(requestUrl);
    const cached = isAsset ? await matchCachedUrl(cache, requestUrl) : null;
    if (cached && !options.force) return;

    const request = new Request(requestUrl.href, { cache: options.force ? "reload" : isAsset ? "default" : "reload", credentials: "same-origin" });
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

async function getNavigationFallback(cache, requestUrl) {
  const directMatch = await cache.match(requestUrl.pathname, { ignoreSearch: true });
  if (directMatch) return directMatch;

  const workerShellMatch = await matchAny(cache, getWorkerNavigationFallbacks(requestUrl.pathname));
  if (workerShellMatch) return workerShellMatch;

  if (requestUrl.pathname === "/worker" || requestUrl.pathname.startsWith("/worker/")) {
    return (await cache.match("/worker", { ignoreSearch: true }))
      || (await cache.match("/", { ignoreSearch: true }))
      || null;
  }

  return (await cache.match(APP_SHELL_FALLBACK_URL, { ignoreSearch: true }))
    || (await cache.match("/", { ignoreSearch: true }))
    || null;
}

async function refreshNavigationCache(request, cache) {
  const response = await fetch(request);
  if (response && response.ok) await putAppShell(cache, request, response.clone(), { warmAssets: false });
  return response;
}

async function staleWhileRevalidateNavigation(event) {
  const request = event.request;
  const cache = await caches.open(CACHE_VERSION);
  const requestUrl = new URL(request.url);
  const cached = (await cache.match(request))
    || (await cache.match(requestUrl.pathname, { ignoreSearch: true }));
  const refreshed = refreshNavigationCache(request, cache).catch(() => getNavigationFallback(cache, requestUrl));
  if (cached) {
    event.waitUntil(refreshed.then(() => undefined));
    return cached;
  }
  return refreshed.then((response) => response || Response.error());
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


function parsePushPayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return { title: "Tho Den Ngay", body: event.data ? event.data.text() : "Ban co thong bao moi" };
  }
}

self.addEventListener("push", (event) => {
  if (IS_LOCAL_DEV_HOST) return;
  const payload = parsePushPayload(event);
  const expiresAt = payload.expiresAt || payload.expires_at;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return;

  const title = payload.title || "Tho Den Ngay";
  const options = {
    body: payload.body || "Ban co thong bao moi",
    icon: payload.icon || "/android-chrome-192x192.png",
    badge: payload.badge || "/favicon-32x32.png",
    tag: payload.tag || payload.notificationId || payload.notification_id || undefined,
    renotify: false,
    data: {
      url: payload.url || payload.targetUrl || payload.target_url || "/",
      notificationId: payload.notificationId || payload.notification_id || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
self.addEventListener("fetch", (event) => {
  if (IS_LOCAL_DEV_HOST) return;

  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (!shouldHandleRequest(requestUrl)) return;

  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidateNavigation(event));
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
