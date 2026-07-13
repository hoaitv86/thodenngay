"use client";

import React from "react";
import { workflowSections, type WorkflowData } from "@/config/serviceWorkflows";

type Props = {
  data?: WorkflowData | null;
};

const labelForValue = (sectionKey: string, fieldKey: string, value: unknown) => {
  const section = workflowSections[sectionKey as keyof typeof workflowSections];
  const field = section?.fields?.find((item) => item.key === fieldKey);
  if (field?.type === "password" && value) return "Da luu";
  if (field?.options) return field.options.find((option) => option.value === value)?.label || String(value || "");
  return String(value ?? "");
};

const compactEntries = (sectionKey: string, sectionValue: Record<string, unknown>) =>
  Object.entries(sectionValue).filter(([key, value]) => key !== "devices" && value !== undefined && value !== null && String(value).trim() !== "");

function QRTextPreview({ value }: { value: string }) {
  const cells = Array.from({ length: 49 }, (_, index) => {
    const code = value.charCodeAt(index % Math.max(value.length, 1)) || 0;
    return (code + index * 17) % 3 !== 0;
  });

  return (
    <div className="grid h-20 w-20 shrink-0 grid-cols-7 gap-0.5 rounded-lg border border-outline-variant/30 bg-white p-1" title={value}>
      {cells.map((active, index) => (
        <span key={index} className={active ? "rounded-[1px] bg-on-surface" : "rounded-[1px] bg-white"} />
      ))}
    </div>
  );
}

export function JobWorkflowSummary({ data }: Props) {
  const entries = Object.entries(data || {}).filter(([, value]) => value && typeof value === "object");
  if (entries.length === 0) return null;

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
                      <div key={index} className="flex gap-3 rounded-lg bg-surface-container-low p-3">
                        {qrText && <QRTextPreview value={qrText} />}
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="font-bold text-on-surface">{String(device.name || `Camera ${index + 1}`)}</p>
                          {["location", "serial", "uid", "qrText", "note"].map((key) => (
                            device[key] ? (
                              <p key={key} className="mt-1 break-words text-xs text-on-surface-variant">
                                <span className="font-bold uppercase">{key}: </span>{String(device[key])}
                              </p>
                            ) : null
                          ))}
                        </div>
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
