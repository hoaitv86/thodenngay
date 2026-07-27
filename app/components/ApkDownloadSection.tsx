"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  LinkIcon,
  PhoneIcon,
  ShieldCheckIcon,
} from "./icons";

type ApkDownloadSectionProps = {
  downloadUrl: string;
  backupDownloadUrl?: string;
  qrCodeDataUrl: string;
  version: string;
  updatedAt: string;
  fileSize: string;
};

export default function ApkDownloadSection({
  downloadUrl,
  backupDownloadUrl,
  qrCodeDataUrl,
  version,
  updatedAt,
  fileSize,
}: ApkDownloadSectionProps) {
  const [isAppleMobile, setIsAppleMobile] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "primary-copied" | "backup-copied" | "failed">("idle");
  const backupUrl = backupDownloadUrl?.trim() || "";

  useEffect(() => {
    const userAgent = window.navigator.userAgent || "";
    const isIpadOsDesktopMode =
      window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;

    setIsAppleMobile(/iPhone|iPad|iPod/i.test(userAgent) || isIpadOsDesktopMode);
  }, []);

  async function copyDownloadLink(url: string, successStatus: "primary-copied" | "backup-copied") {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus(successStatus);
    } catch {
      setCopyStatus("failed");
    }

    window.setTimeout(() => setCopyStatus("idle"), 2200);
  }

  return (
    <section id="download-app" className="bg-surface-container-low py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-stretch gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative overflow-hidden rounded-xl border border-outline-variant/25 bg-white p-5 shadow-[0_18px_50px_rgba(15,35,66,0.08)] sm:p-8">
            <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary-container via-secondary-container to-success" />
            <span className="section-eyebrow">Tải ứng dụng</span>
            <h2 className="mt-3 text-3xl font-bold text-on-surface sm:text-5xl">
              Cài app Thợ đến ngay trên Android
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-on-surface-variant sm:text-lg">
              Tải file APK chính thức để đặt dịch vụ, theo dõi công việc và nhận hỗ trợ nhanh hơn
              ngay trên điện thoại.
            </p>

            {isAppleMobile ? (
              <div className="mt-6 flex items-start gap-3 rounded-lg border border-warning/25 bg-warning-container px-4 py-3 text-warning">
                <AlertTriangleIcon size={22} className="mt-0.5 shrink-0" />
                <p className="text-sm font-semibold">Ứng dụng hiện chỉ hỗ trợ Android</p>
              </div>
            ) : null}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="/downloads/thodenngay.apk"
                download
                className="btn-primary !min-h-12 !px-6 !py-3.5 sm:!w-auto"
                id="apk-download-button"
              >
                <PhoneIcon size={20} />
                Tải APK Android
              </a>
              <button
                type="button"
                onClick={() => copyDownloadLink(downloadUrl, "primary-copied")}
                className="btn-outline !min-h-12 !px-6 !py-3.5 sm:!w-auto"
                id="apk-copy-link-button"
              >
                {copyStatus === "primary-copied" ? <CheckCircleIcon size={20} /> : <LinkIcon size={20} />}
                {copyStatus === "primary-copied"
                  ? "Đã sao chép"
                  : copyStatus === "failed"
                    ? "Không sao chép được"
                    : "Sao chép link tải"}
              </button>
              {backupUrl ? (
                <a
                  href={backupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline !min-h-12 !px-6 !py-3.5 sm:!w-auto"
                  id="apk-backup-download-button"
                >
                  <LinkIcon size={20} />
                  Tải dự phòng
                </a>
              ) : null}
            </div>

            <div className="mt-7 rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-4">
              <p className="mb-2 text-xs font-bold uppercase text-on-surface-variant">
                Link tải đầy đủ
              </p>
              <p className="break-all rounded-md bg-surface-container-low px-3 py-2 font-mono text-sm text-primary-container">
                {downloadUrl}
              </p>
            </div>

            {backupUrl ? (
              <div className="mt-4 rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-4">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-bold uppercase text-on-surface-variant">
                    Link tải dự phòng
                  </p>
                  <button
                    type="button"
                    onClick={() => copyDownloadLink(backupUrl, "backup-copied")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-outline-variant bg-white px-3 py-1.5 text-xs font-bold text-primary-container transition-colors hover:bg-primary-fixed/40"
                  >
                    {copyStatus === "backup-copied" ? <CheckCircleIcon size={14} /> : <LinkIcon size={14} />}
                    {copyStatus === "backup-copied" ? "Đã sao chép" : "Sao chép"}
                  </button>
                </div>
                <p className="break-all rounded-md bg-surface-container-low px-3 py-2 font-mono text-sm text-primary-container">
                  {backupUrl}
                </p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Phiên bản", version],
                ["Ngày cập nhật", updatedAt],
                ["Dung lượng file", fileSize],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-outline-variant/25 bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-on-surface-variant">{label}</p>
                  <p className="mt-1 text-lg font-bold text-on-surface">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-outline-variant/25 bg-primary-container p-5 text-white shadow-[0_18px_54px_rgba(37,99,235,0.18)] sm:p-8">
            <div>
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/14">
                <ShieldCheckIcon size={25} />
              </div>
              <h3 className="text-2xl font-bold !text-white">Quét mã QR để tải APK</h3>
              <p className="mt-3 text-sm leading-6 !text-white/76">
                Mở camera hoặc ứng dụng quét QR trên điện thoại Android, quét mã bên dưới và cài
                đặt file APK.
              </p>
            </div>

            <div className="mt-7 rounded-xl bg-white p-4 shadow-[0_16px_42px_rgba(0,0,0,0.18)]">
              <Image
                src={qrCodeDataUrl}
                alt="Mã QR tải APK Thợ đến ngay"
                width={256}
                height={256}
                className="mx-auto h-auto w-full max-w-[256px]"
                unoptimized
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
