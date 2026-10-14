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
const DEPLOY_ASSET_RECOVERY_SESSION_KEY = "tdn.webDeploy.assetRecoveryOnce.v1";
const DEPLOY_VERSION_CHECK_INTERVAL_MS = 60_000;
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const LOCAL_DEV_SW_RELOAD_KEY = "tdn.localDev.swCleanupReloaded.v1";
const NATIVE_REFRESH_QUERY_PARAM = "nativeRefresh";
const NATIVE_REFRESH_SESSION_KEY = "tdn.nativeRefresh.cleaned.v1";
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

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function registerPushSubscription(registration: ServiceWorkerRegistration) {
  if (!("PushManager" in window) || !("Notification" in window) || !window.navigator.onLine) return;

  try {
    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== "granted") return;

    const keyResponse = await fetch("/api/notifications/push-subscription", { cache: "no-store" });
    if (!keyResponse.ok) return;
    const keyPayload = (await keyResponse.json()) as { publicKey?: string; configured?: boolean };
    if (!keyPayload.configured || !keyPayload.publicKey) return;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey),
    });

    await fetch("/api/notifications/push-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON(), userAgent: window.navigator.userAgent }),
    });
  } catch (error) {
    console.warn("[TDN-PUSH] push subscription registration failed", error);
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


function getCleanNativeRefreshUrl() {
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete(NATIVE_REFRESH_QUERY_PARAM);
  cleanUrl.searchParams.delete("t");
  return cleanUrl.href;
}

async function handleNativeRefreshRecovery(registration: ServiceWorkerRegistration) {
  const reason = new URL(window.location.href).searchParams.get(NATIVE_REFRESH_QUERY_PARAM);
  if (!reason || !window.navigator.onLine) return false;

  const token = `${reason}:${window.location.pathname}`;
  if (readSessionValue(NATIVE_REFRESH_SESSION_KEY) === token) return false;

  writeSessionValue(NATIVE_REFRESH_SESSION_KEY, token);
  removeSessionValue(APP_SHELL_WARM_SIGNATURE_KEY);

  try {
    await registration.update();
  } catch (error) {
    console.warn("[TDN-OFFLINE] native refresh service worker update check failed", error);
  }

  window.location.replace(getCleanNativeRefreshUrl());
  return true;
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

function isNextStaticAssetUrl(value: string) {
  try {
    const url = new URL(value, window.location.href);
    return url.origin === window.location.origin
      && url.pathname.startsWith("/_next/static/")
      && /\.(?:js|css)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function getErrorText(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error === "object") {
    const record = error as { name?: unknown; message?: unknown; stack?: unknown };
    return [record.name, record.message, record.stack].filter(Boolean).join(" ");
  }
  return String(error);
}

function isLikelyDeployAssetError(error: unknown) {
  return /ChunkLoadError|Loading chunk \d+ failed|Loading CSS chunk \d+ failed|Failed to fetch dynamically imported module|Importing a module script failed|net::ERR_FAILED/i.test(
    getErrorText(error)
  );
}

function collectNextStaticAssets(html: string) {
  const urls = new Set<string>();
  try {
    const document = new DOMParser().parseFromString(html, "text/html");
    document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src],link[href]").forEach((element) => {
      const value = element instanceof HTMLScriptElement ? element.src : element.href;
      if (isNextStaticAssetUrl(value)) urls.add(new URL(value, window.location.origin).href);
    });
  } catch {
    const pattern = /\b(?:src|href)=["']([^"']*\/_next\/static\/[^"']+\.(?:js|css))(?:\?[^"']*)?["']/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html))) {
      try {
        const url = new URL(match[1], window.location.origin);
        if (isNextStaticAssetUrl(url.href)) urls.add(url.href);
      } catch {
        // Ignore malformed asset URLs in a deploy probe response.
      }
    }
  }
  return Array.from(urls).slice(0, 24);
}

async function fetchOk(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Cache-Control": "no-cache" },
  });
  return response.ok;
}

async function verifyDeployReady(nextVersion: string) {
  const probeUrl = new URL(window.location.href);
  probeUrl.searchParams.delete(NATIVE_REFRESH_QUERY_PARAM);
  probeUrl.searchParams.delete("t");
  probeUrl.searchParams.set("deployProbe", nextVersion);
  probeUrl.searchParams.set("t", String(Date.now()));

  const response = await fetch(probeUrl.href, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Cache-Control": "no-cache", Accept: "text/html" },
  });
  if (!response.ok) return { ready: false, reason: `shell-status-${response.status}` };

  const html = await response.text();
  if (!html.includes("__next")) return { ready: false, reason: "missing-next-shell" };

  const assets = collectNextStaticAssets(html);
  if (assets.length === 0) return { ready: false, reason: "missing-next-assets" };

  const checks = await Promise.all(
    assets.map(async (assetUrl) => ({ assetUrl, ok: await fetchOk(assetUrl).catch(() => false) }))
  );
  const failed = checks.find((check) => !check.ok);
  if (failed) return { ready: false, reason: "asset-unavailable", assetUrl: failed.assetUrl };

  return { ready: true, reason: "ok", assetCount: assets.length };
}

function hasPotentialUnsavedFormData() {
  try {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return true;

    return Array.from(document.querySelectorAll("input, textarea, select")).some((element) => {
      if (element instanceof HTMLInputElement) {
        if (["hidden", "button", "submit", "reset", "checkbox", "radio"].includes(element.type)) return false;
        return element.value.trim().length > 0;
      }
      if (element instanceof HTMLTextAreaElement) return element.value.trim().length > 0;
      if (element instanceof HTMLSelectElement) return element.selectedIndex > 0;
      return false;
    });
  } catch {
    return true;
  }
}

async function recoverFromDeployAssetError(reason: string, detail: Record<string, unknown> = {}) {
  if (isLocalDevHost() || !window.navigator.onLine || !("serviceWorker" in navigator)) return;

  const nextVersion = await fetchDeployVersion().catch(() => null);
  const currentVersion = readLocalValue(DEPLOY_VERSION_STORAGE_KEY);
  const recoveryToken = `${currentVersion || "unknown"}->${nextVersion || "unknown"}:${window.location.pathname}`;

  if (readSessionValue(DEPLOY_ASSET_RECOVERY_SESSION_KEY) === recoveryToken) return;
  writeSessionValue(DEPLOY_ASSET_RECOVERY_SESSION_KEY, recoveryToken);
  if (nextVersion) writeLocalValue(DEPLOY_VERSION_STORAGE_KEY, nextVersion);

  const registration = await navigator.serviceWorker.ready;
  await refreshDeployCache(registration);

  console.warn("[TDN-OFFLINE] deploy asset recovery", { reason, currentVersion, nextVersion, ...detail });
  if (hasPotentialUnsavedFormData()) {
    console.warn("[TDN-OFFLINE] deploy asset recovery reload skipped", { reason: "possible-unsaved-form-data" });
    return;
  }

  window.setTimeout(() => window.location.reload(), 250);
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
        console.info("[TDN-OFFLINE]", "web deploy reload already attempted", { from: currentVersion, to: nextVersion, reason });
        return;
      }

      writeSessionValue(DEPLOY_RELOAD_SESSION_KEY, reloadToken);

      if (hasPotentialUnsavedFormData()) {
        console.info("[TDN-OFFLINE]", "web deploy refresh deferred", { from: currentVersion, to: nextVersion, reason: "possible-unsaved-form-data" });
        removeSessionValue(DEPLOY_RELOAD_SESSION_KEY);
        return;
      }

      const readiness = await verifyDeployReady(nextVersion);
      if (!readiness.ready) {
        console.warn("[TDN-OFFLINE] web deploy refresh deferred", { from: currentVersion, to: nextVersion, reason, readiness });
        removeSessionValue(DEPLOY_RELOAD_SESSION_KEY);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      await refreshDeployCache(registration);

      writeLocalValue(DEPLOY_VERSION_STORAGE_KEY, nextVersion);
      console.info("[TDN-OFFLINE]", "web deploy update verified", { from: currentVersion, to: nextVersion, reason, readiness });
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
        void navigator.serviceWorker?.ready.then((registration) => registerPushSubscription(registration));
        checkForWebDeployUpdate("online", true);
      }
    };
    window.addEventListener("online", handleOnlineStateChange);
    window.addEventListener("offline", handleOnlineStateChange);

    const handleVisibleOrResumed = () => {
      if (document.visibilityState === "visible") checkForWebDeployUpdate("resume");
    };
    const handlePageShow = () => checkForWebDeployUpdate("pageshow");
    const handleResourceError = (event: Event) => {
      const target = event.target;
      const assetUrl =
        target instanceof HTMLScriptElement
          ? target.src
          : target instanceof HTMLLinkElement
            ? target.href
            : "";
      if (!assetUrl || !isNextStaticAssetUrl(assetUrl)) return;
      void recoverFromDeployAssetError("resource-error", { assetUrl });
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isLikelyDeployAssetError(event.reason)) return;
      void recoverFromDeployAssetError("unhandled-rejection", { error: getErrorText(event.reason) });
    };
    const handleRuntimeError = (event: ErrorEvent) => {
      if (!isLikelyDeployAssetError(event.error || event.message || event.filename)) return;
      void recoverFromDeployAssetError("runtime-error", {
        error: getErrorText(event.error || event.message),
        source: event.filename || null,
      });
    };
    window.addEventListener("focus", handleVisibleOrResumed);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("error", handleResourceError, true);
    window.addEventListener("error", handleRuntimeError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
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
          .register("/offline-sw.js", { scope: "/", updateViaCache: "none" })
          .then((registration) => {
            window.dispatchEvent(
              new CustomEvent(OFFLINE_READY_EVENT, {
                detail: { scope: registration.scope },
              })
            );
            void navigator.serviceWorker.ready.then(async (readyRegistration) => {
              if (await handleNativeRefreshRecovery(readyRegistration)) return;
              sendAppShellCacheMessage(readyRegistration);
              void registerPushSubscription(readyRegistration);
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
      window.removeEventListener("error", handleResourceError, true);
      window.removeEventListener("error", handleRuntimeError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      document.removeEventListener("visibilitychange", handleVisibleOrResumed);
    };
  }, []);

  return null;
}


