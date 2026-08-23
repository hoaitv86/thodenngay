"use client";

import { useEffect } from "react";
import { getOfflineWorkerAuthSnapshot, rememberOfflineAuthenticatedUser } from "@/lib/offline/session";
import { syncOfflineMutations } from "@/lib/offline/cache";
import { isWorkerDetailRoute, WORKER_OFFLINE_SHELL_PATHS } from "@/lib/offline/worker-detail-cache";
import { createClient } from "@/lib/supabase/client";

const OFFLINE_READY_EVENT = "tdn:offline-ready";
const CACHE_APP_SHELL_MESSAGE = "TDN_CACHE_APP_SHELL";

function publishNetworkState() {
  window.dispatchEvent(
    new CustomEvent("tdn:network-state", {
      detail: { online: window.navigator.onLine, checkedAt: new Date().toISOString() },
    })
  );
}

function collectWorkerDetailUrls(urls: Set<string>) {
  document.querySelectorAll<HTMLAnchorElement>('a[href^="/worker/"]').forEach((anchor) => {
    try {
      const parsed = new URL(anchor.href, window.location.origin);
      if (parsed.origin !== window.location.origin) return;
      if (isWorkerDetailRoute(parsed.pathname)) urls.add(parsed.href);
    } catch {
      // Ignore malformed href values.
    }
  });
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
    WORKER_OFFLINE_SHELL_PATHS.forEach((path) => urls.add(new URL(path, window.location.origin).href));
    collectWorkerDetailUrls(urls);
    console.info("[TDN-OFFLINE]", "worker route shell cache", {
      route: window.location.pathname,
      identityFound: Boolean(workerIdentity),
      redirectReason: null,
      routes: Array.from(urls)
        .map((url) => new URL(url).pathname)
        .filter((path) => path.startsWith("/worker")),
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

  let debounceId = 0;
  const send = () => {
    window.clearTimeout(debounceId);
    debounceId = window.setTimeout(() => {
      const worker = registration.active || navigator.serviceWorker.controller;
      if (!worker || !window.navigator.onLine) return;
      worker.postMessage({ type: CACHE_APP_SHELL_MESSAGE, urls: collectAppShellUrls() });
    }, 100);
  };

  send();
  window.setTimeout(send, 1500);
  window.setTimeout(send, 4000);

  const observer = new MutationObserver(() => send());
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 10000);
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
