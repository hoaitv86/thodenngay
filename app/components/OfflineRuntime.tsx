"use client";

import { useEffect } from "react";
import { getOfflineWorkerAuthSnapshot, rememberOfflineAuthenticatedUser } from "@/lib/offline/session";
import { syncOfflineMutations } from "@/lib/offline/cache";
import { createClient } from "@/lib/supabase/client";

const OFFLINE_READY_EVENT = "tdn:offline-ready";
const CACHE_APP_SHELL_MESSAGE = "TDN_CACHE_APP_SHELL";
const WORKER_APP_SHELL_PATHS = [
  "/worker",
  "/worker/jobs",
  "/worker/customers",
  "/worker/billgo",
  "/worker/history",
  "/worker/profile",
  "/worker/chat",
  "/worker/inventory",
  "/worker/sales",
];

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

  const workerIdentity = getOfflineWorkerAuthSnapshot();
  const shouldCacheWorkerRoutes = Boolean(workerIdentity) || window.location.pathname.startsWith("/worker");
  if (shouldCacheWorkerRoutes) {
    WORKER_APP_SHELL_PATHS.forEach((path) => urls.add(new URL(path, window.location.origin).href));
    console.info("[TDN-OFFLINE]", "worker route shell cache", {
      route: window.location.pathname,
      identityFound: Boolean(workerIdentity),
      redirectReason: null,
      routes: WORKER_APP_SHELL_PATHS,
    });
  }

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

function sendAppShellCacheMessage(registration: ServiceWorkerRegistration) {
  if (!window.navigator.onLine) return;

  const send = () => {
    const worker = registration.active || navigator.serviceWorker.controller;
    if (!worker) return;
    worker.postMessage({ type: CACHE_APP_SHELL_MESSAGE, urls: collectAppShellUrls() });
  };

  send();
  window.setTimeout(send, 1500);
}

export default function OfflineRuntime() {
  useEffect(() => {
    publishNetworkState();
    if (window.navigator.onLine) void syncOfflineMutations();

    const handleOnlineStateChange = () => {
      publishNetworkState();
      if (window.navigator.onLine) void syncOfflineMutations();
    };
    window.addEventListener("online", handleOnlineStateChange);
    window.addEventListener("offline", handleOnlineStateChange);

    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) rememberOfflineAuthenticatedUser(data.session.user);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) rememberOfflineAuthenticatedUser(session.user);
    });

    if ("serviceWorker" in navigator) {
      const registerServiceWorker = () => {
        navigator.serviceWorker
          .register("/offline-sw.js", { scope: "/" })
          .then((registration) => {
            window.dispatchEvent(
              new CustomEvent(OFFLINE_READY_EVENT, {
                detail: { scope: registration.scope },
              })
            );
            sendAppShellCacheMessage(registration);
            void navigator.serviceWorker.ready.then(sendAppShellCacheMessage);
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
    };
  }, []);

  return null;
}
