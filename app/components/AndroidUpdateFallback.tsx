"use client";

import { useEffect, useState } from "react";

type NormalizedUpdate = {
  versionCode: number;
  versionName: string;
  releaseNotes: string;
  apkUrl: string;
};

type UpdateMetadata = {
  versionCode?: number | string;
  versionName?: string;
  releaseNotes?: string;
  apkUrl?: string;
};

const metadataUrl = "https://github.com/hoaitv86/thodenngay/releases/latest/download/latest.json";
const defaultApkUrl = "https://github.com/hoaitv86/thodenngay/releases/latest/download/thodenngay.apk";
const dismissedStorageKey = "tdn-web-update-dismissed-version";

function isAndroidWebViewWithoutNativeUpdater() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const userAgent = window.navigator.userAgent || "";
  const isAndroidApp = params.get("app") === "android" || /; wv\)/i.test(userAgent) || /\bVersion\/[\d.]+ Chrome\/[\d.]+ Mobile Safari\//i.test(userAgent);
  const hasNativeUpdater = /\bNativeUpdater\/1\b/i.test(userAgent) || /\bThoDenNgayAndroid\/\d+/i.test(userAgent);
  return isAndroidApp && !hasNativeUpdater;
}

function normalizeMetadata(payload: UpdateMetadata): NormalizedUpdate | null {
  const versionCode = typeof payload.versionCode === "number" ? payload.versionCode : Number(payload.versionCode);
  if (!Number.isFinite(versionCode) || versionCode <= 0) return null;
  const apkUrl = typeof payload.apkUrl === "string" && payload.apkUrl.trim().startsWith("https://")
    ? payload.apkUrl.trim()
    : defaultApkUrl;
  return {
    versionCode,
    versionName: typeof payload.versionName === "string" ? payload.versionName.trim() : "",
    releaseNotes: typeof payload.releaseNotes === "string" ? payload.releaseNotes.trim() : "",
    apkUrl,
  };
}

export default function AndroidUpdateFallback() {
  const [update, setUpdate] = useState<NormalizedUpdate | null>(null);

  useEffect(() => {
    if (!isAndroidWebViewWithoutNativeUpdater()) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${metadataUrl}?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const metadata = normalizeMetadata(await response.json());
        if (!metadata) return;
        if (window.localStorage.getItem(dismissedStorageKey) === String(metadata.versionCode)) return;
        if (!cancelled) setUpdate(metadata);
      } catch {
        // Web fallback must not interrupt normal login/worker flows.
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!update) return null;

  const versionName = update.versionName || String(update.versionCode);
  const releaseNotes = update.releaseNotes || "Có bản cập nhật mới sẵn sàng.";

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] bg-surface-container-high px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 shadow-2xl ring-1 ring-outline/20">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        <div>
          <p className="text-sm font-extrabold text-on-surface">Cập nhật Thợ Đến Ngay {versionName}</p>
          <p className="mt-1 text-sm font-medium leading-5 text-on-surface-variant">{releaseNotes}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-lg border border-outline/40 bg-surface px-4 py-3 text-sm font-extrabold text-on-surface"
            onClick={() => {
              window.localStorage.setItem(dismissedStorageKey, String(update.versionCode));
              setUpdate(null);
            }}
          >
            Để sau
          </button>
          <a
            className="rounded-lg bg-primary px-4 py-3 text-center text-sm font-extrabold text-white"
            href={update.apkUrl}
            download
          >
            Cập nhật ngay
          </a>
        </div>
      </div>
    </div>
  );
}
