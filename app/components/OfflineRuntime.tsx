"use client";

import { useEffect } from "react";
import { rememberOfflineAuthenticatedUser } from "@/lib/offline/session";
import { syncOfflineMutations } from "@/lib/offline/cache";
import { createClient } from "@/lib/supabase/client";

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
      authListener.subscription.unsubscribe();
      window.removeEventListener("online", handleOnlineStateChange);
      window.removeEventListener("offline", handleOnlineStateChange);
    };
  }, []);

  return null;
}
