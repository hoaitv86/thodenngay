"use client";

import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink } from "lucide-react";
import { workflowSections, type WorkflowData } from "@/config/serviceWorkflows";

type Props = {
  data?: WorkflowData | null;
};

const labelForValue = (sectionKey: string, fieldKey: string, value: unknown) => {
  const section = workflowSections[sectionKey as keyof typeof workflowSections];
  const field = section?.fields?.find((item) => item.key === fieldKey);
  if (sectionKey === "camera_account") return String(value ?? "");
  if (field?.type === "password" && value) return "Da luu";
  if (field?.options) return field.options.find((option) => option.value === value)?.label || String(value || "");
  return String(value ?? "");
};

const compactEntries = (sectionKey: string, sectionValue: Record<string, unknown>) =>
  Object.entries(sectionValue).filter(([key, value]) => key !== "devices" && value !== undefined && value !== null && String(value).trim() !== "");

const getStringValue = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value).trim() : "");

const getUrlValue = (value: string) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};

function CopyButton({ value, label = "Sao chép" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-white px-2.5 text-[11px] font-extrabold text-on-surface-variant hover:border-primary-container hover:text-primary-container"
      title={label}
    >
      <Copy size={13} />
      {copied ? "Đã chép" : label}
    </button>
  );
}

function CameraInfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-on-surface-variant">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-on-surface">{value}</p>
      </div>
      <CopyButton value={value} />
    </div>
  );
}

function CameraQRCode({
  value,
  account,
  password,
  title,
}: {
  value: string;
  account: string;
  password: string;
  title: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const link = getUrlValue(value);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;

    let cancelled = false;
    setReady(false);
    QRCode.toCanvas(canvas, value, {
      width: 240,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(() => {
      if (!cancelled) setReady(true);
    }).catch(() => {
      if (!cancelled) setReady(false);
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;

    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "camera"}-qr.png`;
    anchor.click();
  };

  return (
    <div className="grid gap-3 rounded-lg bg-surface-container-low p-3 md:grid-cols-[260px_1fr]">
      <div className="flex flex-col items-center gap-2 rounded-lg bg-white p-3">
        <canvas ref={canvasRef} width={240} height={240} className="h-60 w-60 max-w-full" aria-label={`QR ${title}`} />
        <div className="flex flex-wrap justify-center gap-2">
          <CopyButton value={value} label="Sao chép QR" />
          <button
            type="button"
            onClick={handleDownload}
            disabled={!ready}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-white px-2.5 text-[11px] font-extrabold text-on-surface-variant hover:border-primary-container hover:text-primary-container disabled:opacity-50"
            title="Tải QR"
          >
            <Download size={13} />
            Tải QR
          </button>
        </div>
      </div>
      <div className="min-w-0 space-y-2 text-sm">
        <p className="font-bold text-on-surface">{title}</p>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 break-all rounded-lg bg-white px-2.5 py-2 text-xs font-semibold text-primary-container hover:underline"
          >
            <ExternalLink size={13} className="shrink-0" />
            {link}
          </a>
        )}
        <CameraInfoRow label="Tài khoản" value={account} />
        <CameraInfoRow label="Mật khẩu" value={password} />
        <CameraInfoRow label="QR Text" value={value} />
      </div>
    </div>
  );
}

export function JobWorkflowSummary({ data }: Props) {
  const entries = Object.entries(data || {}).filter(([, value]) => value && typeof value === "object");
  if (entries.length === 0) return null;

  const cameraAccountSection = (data?.camera_account || {}) as Record<string, unknown>;
  const cameraAccount = getStringValue(cameraAccountSection.username);
  const cameraPassword = getStringValue(cameraAccountSection.password);

  return (
    <div className="space-y-3">
      <h3 className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">Chi tiết công việc</h3>
      <div className="space-y-3">
        {entries.map(([sectionKey, rawSection]) => {
          const section = workflowSections[sectionKey as keyof typeof workflowSections];
          const sectionValue = rawSection as Record<string, unknown>;
          const devices = Array.isArray(sectionValue.devices) ? sectionValue.devices as Array<Record<string, unknown>> : [];
          const fields = compactEntries(sectionKey, sectionValue);

          if (fields.length === 0 && devices.length === 0) return null;

          return (
            <div key={sectionKey} className="rounded-lg border border-outline-variant/20 bg-white p-4 shadow-sm">
              <p className="text-sm font-extrabold text-on-surface">{section?.title || sectionKey}</p>
              {fields.length > 0 && (
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {fields.map(([fieldKey, value]) => (
                    <div key={fieldKey} className="rounded-lg bg-surface-container-low p-3">
                      <dt className="text-[11px] font-bold uppercase text-on-surface-variant">{section?.fields?.find((field) => field.key === fieldKey)?.label || fieldKey}</dt>
                      <dd className="mt-1 break-words font-semibold text-on-surface">{labelForValue(sectionKey, fieldKey, value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {devices.length > 0 && (
                <div className="mt-3 space-y-3">
                  {devices.map((device, index) => {
                    const qrText = String(device.qrText || "");
                    return (
                      <div key={index} className="space-y-3 rounded-lg bg-surface-container-low p-3">
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="font-bold text-on-surface">{String(device.name || `Camera ${index + 1}`)}</p>
                          {["location", "serial", "uid", "note"].map((key) => (
                            device[key] ? (
                              <p key={key} className="mt-1 break-words text-xs text-on-surface-variant">
                                <span className="font-bold uppercase">{key}: </span>{String(device[key])}
                              </p>
                            ) : null
                          ))}
                        </div>
                        {qrText && (
                          <CameraQRCode
                            value={qrText}
                            account={cameraAccount || getStringValue(device.account)}
                            password={cameraPassword || getStringValue(device.password)}
                            title={String(device.name || `Camera ${index + 1}`)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
