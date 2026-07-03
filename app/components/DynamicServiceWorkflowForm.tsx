"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  getWorkflowSectionsForServices,
  type ServiceLikeForWorkflow,
  type WorkflowData,
  type WorkflowField,
  type WorkflowSectionConfig,
} from "@/config/serviceWorkflows";

type CameraDevice = {
  name?: string;
  location?: string;
  serial?: string;
  uid?: string;
  qrText?: string;
  note?: string;
};

type Props = {
  services: ServiceLikeForWorkflow[];
  value: WorkflowData;
  onChange: (value: WorkflowData) => void;
};

const getSectionValue = (value: WorkflowData, key: string) => value[key] || {};

function WorkflowInput({
  field,
  value,
  onChange,
}: {
  field: WorkflowField;
  value: unknown;
  onChange: (nextValue: unknown) => void;
}) {
  const commonClass = "input-field w-full !rounded-lg text-sm";
  const stringValue = typeof value === "string" || typeof value === "number" ? String(value) : "";

  if (field.type === "textarea") {
    return (
      <textarea
        className={`${commonClass} min-h-[84px] resize-none`}
        placeholder={field.placeholder}
        value={stringValue}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select className={commonClass} value={stringValue} onChange={(event) => onChange(event.target.value)}>
        <option value="">-- Chon --</option>
        {(field.options || []).map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={field.type}
      className={commonClass}
      placeholder={field.placeholder}
      value={stringValue}
      onChange={(event) => onChange(field.type === "number" ? Number(event.target.value || 0) : event.target.value)}
      autoComplete={field.type === "password" ? "new-password" : undefined}
    />
  );
}

function CameraDevicesEditor({
  section,
  onSectionChange,
}: {
  section: Record<string, unknown>;
  onSectionChange: (nextSection: Record<string, unknown>) => void;
}) {
  const devices = Array.isArray(section.devices) ? (section.devices as CameraDevice[]) : [];
  const normalizedDevices = devices.length > 0 ? devices : [{}];

  const updateDevice = (index: number, patch: CameraDevice) => {
    const nextDevices = normalizedDevices.map((device, deviceIndex) =>
      deviceIndex === index ? { ...device, ...patch } : device
    );
    onSectionChange({ ...section, devices: nextDevices });
  };

  const removeDevice = (index: number) => {
    const nextDevices = normalizedDevices.filter((_, deviceIndex) => deviceIndex !== index);
    onSectionChange({ ...section, devices: nextDevices.length > 0 ? nextDevices : [{}] });
  };

  return (
    <div className="space-y-3">
      {normalizedDevices.map((device, index) => (
        <div key={index} className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-extrabold uppercase text-on-surface-variant">Camera {index + 1}</p>
            <button
              type="button"
              onClick={() => removeDevice(index)}
              disabled={normalizedDevices.length === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-error hover:bg-error-container disabled:opacity-40"
              aria-label="Xoa camera"
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input-field !rounded-lg text-sm" placeholder="Ten camera" value={device.name || ""} onChange={(event) => updateDevice(index, { name: event.target.value })} />
            <input className="input-field !rounded-lg text-sm" placeholder="Vi tri" value={device.location || ""} onChange={(event) => updateDevice(index, { location: event.target.value })} />
            <input className="input-field !rounded-lg text-sm" placeholder="Serial" value={device.serial || ""} onChange={(event) => updateDevice(index, { serial: event.target.value })} />
            <input className="input-field !rounded-lg text-sm" placeholder="UID neu co" value={device.uid || ""} onChange={(event) => updateDevice(index, { uid: event.target.value })} />
            <textarea className="input-field min-h-[74px] resize-none !rounded-lg text-sm sm:col-span-2" placeholder="QR Text" value={device.qrText || ""} onChange={(event) => updateDevice(index, { qrText: event.target.value })} />
            <textarea className="input-field min-h-[74px] resize-none !rounded-lg text-sm sm:col-span-2" placeholder="Ghi chu" value={device.note || ""} onChange={(event) => updateDevice(index, { note: event.target.value })} />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onSectionChange({ ...section, devices: [...normalizedDevices, {}] })}
        className="inline-flex items-center gap-2 rounded-lg border border-primary-container/30 bg-primary-fixed px-3 py-2 text-xs font-extrabold text-primary-container"
      >
        <Plus size={14} />
        Them camera
      </button>
    </div>
  );
}

function WorkflowSection({
  section,
  value,
  onChange,
}: {
  section: WorkflowSectionConfig;
  value: WorkflowData;
  onChange: (value: WorkflowData) => void;
}) {
  const [open, setOpen] = useState(true);
  const sectionValue = getSectionValue(value, section.key);
  const onSectionChange = (nextSection: Record<string, unknown>) => {
    onChange({ ...value, [section.key]: nextSection });
  };

  return (
    <div className="rounded-lg border border-outline-variant/30 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-extrabold text-on-surface">{section.title}</p>
          {section.description && <p className="mt-0.5 text-xs text-on-surface-variant">{section.description}</p>}
        </div>
        <ChevronDown size={18} className={`shrink-0 text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-outline-variant/20 p-4">
          {section.key === "camera_devices" ? (
            <CameraDevicesEditor section={sectionValue} onSectionChange={onSectionChange} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(section.fields || []).map((field) => (
                <label key={field.key} className={field.type === "textarea" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                  <span className="text-xs font-bold text-on-surface-variant">{field.label}</span>
                  <WorkflowInput
                    field={field}
                    value={sectionValue[field.key]}
                    onChange={(nextValue) => onSectionChange({ ...sectionValue, [field.key]: nextValue })}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DynamicServiceWorkflowForm({ services, value, onChange }: Props) {
  const sections = useMemo(() => getWorkflowSectionsForServices(services), [services]);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-extrabold text-primary-container">Thong tin nghiep vu theo dich vu</p>
        <p className="mt-1 text-xs text-on-surface-variant">Chi hien cac section phu hop voi dich vu da chon.</p>
      </div>
      {sections.map((section) => (
        <WorkflowSection key={section.key} section={section} value={value} onChange={onChange} />
      ))}
    </div>
  );
}
