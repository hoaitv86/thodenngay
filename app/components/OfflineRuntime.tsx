"use client";

import { useEffect } from "react";
import { rememberOfflineAuthenticatedUser } from "@/lib/offline/session";
import { syncOfflineMutations } from "@/lib/offline/cache";
import { createClient } from "@/lib/supabase/client";

const OFFLINE_READY_EVENT = "tdn:offline-ready";
const CACHE_APP_SHELL_MESSAGE = "TDN_CACHE_APP_SHELL";
const REFRESH_DEPLOY_CACHE_MESSAGE = "TDN_REFRESH_DEPLOY_CACHE";
const APP_SHELL_WARM_SIGNATURE_KEY = "tdn.offline.appShellWarmSignature.v1";
const DEPLOY_VERSION_ENDPOINT = "/api/app-version";
const DEPLOY_VERSION_STORAGE_KEY = "tdn.webDeploy.version.v1";
const DEPLOY_RELOAD_SESSION_KEY = "tdn.webDeploy.reloadOnce.v1";
const DEPLOY_VERSION_CHECK_INTERVAL_MS = 60_000;
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const LOCAL_DEV_SW_RELOAD_KEY = "tdn.localDev.swCleanupReloaded.v1";
const TDN_CACHE_KEY_PREFIX = "tdn-";

let lastDeployVersionCheckAt = 0;
let deployVersionCheckInFlight: Promise<void> | null = null;

function isLocalDevHost() {
  return process.env.NODE_ENV !== "production" && LOCAL_DEV_HOSTS.has(window.location.hostname);
}

function publishNetworkState() {
  window.dispatchEvent(
    new CustomEvent("tdn:network-state", {
      detail: { online: window.navigator.onLine, checkedAt: new Date().toISOString() },
    })
  );
}

function collectAppShellUrls() {
  const urls = new Set<string>([
    window.location.href,
    new URL("/", window.location.origin).href,
    new URL("/login", window.location.origin).href,
    new URL("/site.webmanifest", window.location.origin).href,
    new URL("/favicon.ico", window.location.origin).href,
    new URL("/favicon-16x16.png", window.location.origin).href,
    new URL("/favicon-32x32.png", window.location.origin).href,
    new URL("/apple-touch-icon.png", window.location.origin).href,
    new URL("/android-chrome-192x192.png", window.location.origin).href,
    new URL("/android-chrome-512x512.png", window.location.origin).href,
  ]);

  document
    .querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
      'script[src], link[rel="stylesheet"], link[rel="preload"], link[rel="modulepreload"], link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]'
    )
    .forEach((element) => {
      const url = element instanceof HTMLScriptElement ? element.src : element.href;
      if (!url) return;
      try {
        const parsed = new URL(url, window.location.href);
        if (parsed.origin === window.location.origin) urls.add(parsed.href);
      } catch {
        // Ignore malformed browser-provided URLs.
      }
    });

  return Array.from(urls);
}

function getWarmSignature(urls: string[]) {
  return urls.slice().sort().join("\n");
}

function readSessionValue(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Session storage can be unavailable in hardened WebViews.
  }
}

function removeSessionValue(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Session storage can be unavailable in hardened WebViews.
  }
}

function readLocalValue(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Local storage can be unavailable in hardened WebViews.
  }
}

async function clearLocalDevOfflineRuntime() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => registration.scope.startsWith(window.location.origin))
        .map((registration) => registration.unregister())
    );
  } catch (error) {
    console.warn("[TDN-OFFLINE] local dev service worker cleanup failed", error);
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(TDN_CACHE_KEY_PREFIX)).map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn("[TDN-OFFLINE] local dev cache cleanup failed", error);
  }

  if (navigator.serviceWorker.controller) {
    if (readSessionValue(LOCAL_DEV_SW_RELOAD_KEY) !== "1") {
      writeSessionValue(LOCAL_DEV_SW_RELOAD_KEY, "1");
      window.location.reload();
    }
    return;
  }

  removeSessionValue(LOCAL_DEV_SW_RELOAD_KEY);
}

function sendAppShellCacheMessage(registration: ServiceWorkerRegistration) {
  if (!window.navigator.onLine) return;

  const worker = registration.active || navigator.serviceWorker.controller;
  if (!worker) return;

  const urls = collectAppShellUrls();
  const signature = getWarmSignature(urls);
  if (readSessionValue(APP_SHELL_WARM_SIGNATURE_KEY) === signature) {
    console.info("[TDN-OFFLINE]", "app shell cache skipped", { reason: "same-url-list", route: window.location.pathname });
    return;
  }

  writeSessionValue(APP_SHELL_WARM_SIGNATURE_KEY, signature);
  worker.postMessage({ type: CACHE_APP_SHELL_MESSAGE, urls });
}

async function fetchDeployVersion() {
  const versionUrl = new URL(DEPLOY_VERSION_ENDPOINT, window.location.origin);
  versionUrl.searchParams.set("t", String(Date.now()));

  const response = await fetch(versionUrl.href, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as { version?: unknown };
  return typeof payload.version === "string" && payload.version.trim() ? payload.version.trim() : null;
}

async function refreshDeployCache(registration: ServiceWorkerRegistration) {
  try {
    await registration.update();
  } catch (error) {
    console.warn("[TDN-OFFLINE] service worker update check failed", error);
  }

  const readyRegistration = await navigator.serviceWorker.ready;
  const worker = readyRegistration.active || registration.active || navigator.serviceWorker.controller;
  if (!worker) return;

  worker.postMessage({ type: REFRESH_DEPLOY_CACHE_MESSAGE, urls: collectAppShellUrls() });
  removeSessionValue(APP_SHELL_WARM_SIGNATURE_KEY);
}

function checkForWebDeployUpdate(reason: string, force = false) {
  if (isLocalDevHost() || !window.navigator.onLine || !("serviceWorker" in navigator)) return;

  const now = Date.now();
  if (!force && now - lastDeployVersionCheckAt < DEPLOY_VERSION_CHECK_INTERVAL_MS) return;
  if (deployVersionCheckInFlight) return;

  lastDeployVersionCheckAt = now;
  deployVersionCheckInFlight = (async () => {
    try {
      const nextVersion = await fetchDeployVersion();
      if (!nextVersion) return;

      const currentVersion = readLocalValue(DEPLOY_VERSION_STORAGE_KEY);
      if (!currentVersion) {
        writeLocalValue(DEPLOY_VERSION_STORAGE_KEY, nextVersion);
        return;
      }

      if (currentVersion === nextVersion) {
        removeSessionValue(DEPLOY_RELOAD_SESSION_KEY);
        return;
      }

      const reloadToken = `${currentVersion}->${nextVersion}`;
      if (readSessionValue(DEPLOY_RELOAD_SESSION_KEY) === reloadToken) {
        writeLocalValue(DEPLOY_VERSION_STORAGE_KEY, nextVersion);
        return;
      }

      writeSessionValue(DEPLOY_RELOAD_SESSION_KEY, reloadToken);
      writeLocalValue(DEPLOY_VERSION_STORAGE_KEY, nextVersion);

      const registration = await navigator.serviceWorker.ready;
      await refreshDeployCache(registration);

      console.info("[TDN-OFFLINE]", "web deploy update detected", { from: currentVersion, to: nextVersion, reason });
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      console.warn("[TDN-OFFLINE] web deploy update check failed", error);
    } finally {
      deployVersionCheckInFlight = null;
    }
  })();
}

export default function OfflineRuntime() {
  useEffect(() => {
    publishNetworkState();
    if (window.navigator.onLine) void syncOfflineMutations();

    const handleOnlineStateChange = () => {
      publishNetworkState();
      if (window.navigator.onLine) {
        void syncOfflineMutations();
        checkForWebDeployUpdate("online", true);
      }
    };
    window.addEventListener("online", handleOnlineStateChange);
    window.addEventListener("offline", handleOnlineStateChange);

    const handleVisibleOrResumed = () => {
      if (document.visibilityState === "visible") checkForWebDeployUpdate("resume");
    };
    const handlePageShow = () => checkForWebDeployUpdate("pageshow");
    window.addEventListener("focus", handleVisibleOrResumed);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibleOrResumed);

    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) rememberOfflineAuthenticatedUser(data.session.user);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) rememberOfflineAuthenticatedUser(session.user);
    });

    if (isLocalDevHost()) {
      void clearLocalDevOfflineRuntime();
    } else if ("serviceWorker" in navigator) {
      const registerServiceWorker = () => {
        navigator.serviceWorker
          .register("/offline-sw.js", { scope: "/" })
          .then((registration) => {
            window.dispatchEvent(
              new CustomEvent(OFFLINE_READY_EVENT, {
                detail: { scope: registration.scope },
              })
            );
            void navigator.serviceWorker.ready.then((readyRegistration) => {
              sendAppShellCacheMessage(readyRegistration);
              checkForWebDeployUpdate("startup", true);
            });
          })
          .catch((error) => {
            console.warn("Unable to enable offline cache:", error);
          });
      };

      if (document.readyState === "complete") {
        registerServiceWorker();
      } else {
        window.addEventListener("load", registerServiceWorker, { once: true });
      }
    }

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener("online", handleOnlineStateChange);
      window.removeEventListener("offline", handleOnlineStateChange);
      window.removeEventListener("focus", handleVisibleOrResumed);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibleOrResumed);
    };
  }, []);

  return null;
}
