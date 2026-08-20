"use client";

import { useEffect } from "react";

const OFFLINE_READY_EVENT = "tdn:offline-ready";

function publishNetworkState() {
  window.dispatchEvent(
    new CustomEvent("tdn:network-state", {
      detail: { online: window.navigator.onLine, checkedAt: new Date().toISOString() },
    })
  );
}

export default function OfflineRuntime() {
  useEffect(() => {
    publishNetworkState();

    const handleOnlineStateChange = () => publishNetworkState();
    window.addEventListener("online", handleOnlineStateChange);
    window.addEventListener("offline", handleOnlineStateChange);

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/offline-sw.js", { scope: "/" })
          .then((registration) => {
            window.dispatchEvent(
              new CustomEvent(OFFLINE_READY_EVENT, {
                detail: { scope: registration.scope },
              })
            );
          })
          .catch((error) => {
            console.warn("Không thể bật cache offline:", error);
          });
      }, { once: true });
    }

    return () => {
      window.removeEventListener("online", handleOnlineStateChange);
      window.removeEventListener("offline", handleOnlineStateChange);
    };
  }, []);

  return null;
}
