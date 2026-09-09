"use client";

import React, { useMemo, useState } from "react";
import jsQR from "jsqr";
import { ChevronDown, ImageUp, Plus, Trash2 } from "lucide-react";
import {
  cleanCameraWorkflowDevice,
  getWorkflowSectionsForServices,
  type ServiceLikeForWorkflow,
  type WorkflowData,
  type WorkflowField,
  type WorkflowSectionKey,
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
  includeSectionKeys?: WorkflowSectionKey[];
  excludeSectionKeys?: WorkflowSectionKey[];
  disabled?: boolean;
};

const getSectionValue = (value: WorkflowData, key: string) => value[key] || {};
const cleanCameraDevice = (device: CameraDevice) => cleanCameraWorkflowDevice(device) as CameraDevice;
const MAX_QR_DECODE_EDGE = 1200;

const normalizeCameraDevices = (devices: CameraDevice[]) => {
  const cleaned = devices.map(cleanCameraDevice);
  return cleaned.length > 0 ? cleaned : [{}];
};

const readImageFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Không thể đọc ảnh QR."));
    };
    image.src = objectUrl;
  });

const decodeQrImage = async (file: File) => {
  if (!file.type.startsWith("image/")) {
    throw new Error("File QR phải là ảnh.");
  }

  const image = await readImageFile(file);
  const canvas = document.createElement("canvas");
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_QR_DECODE_EDGE / Math.max(sourceWidth, sourceHeight));
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Trình duyệt không hỗ trợ đọc ảnh QR.");

  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });

    if (!decoded?.data) throw new Error("Không tìm thấy mã QR trong ảnh.");
    return decoded.data.trim();
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Không thể đọc ảnh QR.");
  } finally {
    image.removeAttribute("src");
    canvas.width = 0;
    canvas.height = 0;
  }
};

function QRImageUpload({
  onDecoded,
  disabled = false,
}: {
  onDecoded: (qrText: string) => void;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState("");

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setStatus("Đang đọc mã QR...");
    try {
      const qrText = await decodeQrImage(file);
      onDecoded(qrText);
      setStatus("Đã lấy QR Text từ ảnh. Hệ thống chỉ lưu chuỗi text.");
    } catch (error) {
      console.error("[camera-qr] decode failed", error);
      setStatus(error instanceof Error ? error.message : "Không thể đọc mã QR.");
    }
  };

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary-container/30 bg-primary-fixed px-3 py-2 text-xs font-extrabold text-primary-container hover:bg-primary-container/10">
        <ImageUp size={14} />
        Upload ảnh QR
        <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} disabled={disabled} />
      </label>
      {status && <p className="text-xs font-medium text-on-surface-variant">{status}</p>}
    </div>
  );
}

function WorkflowInput({
  field,
  value,
  onChange,
  disabled = false,
}: {
  field: WorkflowField;
  value: unknown;
  onChange: (nextValue: unknown) => void;
  disabled?: boolean;
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
        disabled={disabled}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select className={commonClass} value={stringValue} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        <option value="">-- Chọn --</option>
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
      disabled={disabled}
    />
  );
}

function CameraDevicesEditor({
  section,
  onSectionChange,
  disabled = false,
}: {
  section: Record<string, unknown>;
  onSectionChange: (nextSection: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const devices = Array.isArray(section.devices) ? (section.devices as CameraDevice[]) : [];
  const normalizedDevices = devices.length > 0 ? devices.map(cleanCameraDevice) : [{}];

  const updateDevice = (index: number, patch: CameraDevice) => {
    const nextDevices = normalizedDevices.map((device, deviceIndex) =>
      deviceIndex === index ? cleanCameraDevice({ ...device, ...patch }) : device
    );
    onSectionChange({ ...section, devices: normalizeCameraDevices(nextDevices) });
  };

  const removeDevice = (index: number) => {
    const nextDevices = normalizedDevices.filter((_, deviceIndex) => deviceIndex !== index);
    onSectionChange({ ...section, devices: nextDevices.length > 0 ? nextDevices : [{}] });
  };

  return (
    <div className="space-y-3">
      {normalizedDevices.map((device, index) => (
        <div key={`camera-device-${index}`} className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-extrabold uppercase text-on-surface-variant">Camera {index + 1}</p>
            <button
              type="button"
              onClick={() => removeDevice(index)}
              disabled={disabled || normalizedDevices.length === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-error hover:bg-error-container disabled:opacity-40"
              aria-label="Xóa camera"
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input-field !rounded-lg text-sm" placeholder="Tên camera" value={device.name || ""} onChange={(event) => updateDevice(index, { name: event.target.value })} disabled={disabled} />
            <input className="input-field !rounded-lg text-sm" placeholder="Vị trí" value={device.location || ""} onChange={(event) => updateDevice(index, { location: event.target.value })} disabled={disabled} />
            <input className="input-field !rounded-lg text-sm" placeholder="Serial" value={device.serial || ""} onChange={(event) => updateDevice(index, { serial: event.target.value })} disabled={disabled} />
            <input className="input-field !rounded-lg text-sm" placeholder="UID nếu có" value={device.uid || ""} onChange={(event) => updateDevice(index, { uid: event.target.value })} disabled={disabled} />
            <QRImageUpload onDecoded={(qrText) => updateDevice(index, { qrText })} disabled={disabled} />
            <textarea className="input-field min-h-[74px] resize-none !rounded-lg text-sm sm:col-span-2" placeholder="QR Text" value={device.qrText || ""} onChange={(event) => updateDevice(index, { qrText: event.target.value })} disabled={disabled} />
            <textarea className="input-field min-h-[74px] resize-none !rounded-lg text-sm sm:col-span-2" placeholder="Ghi chú" value={device.note || ""} onChange={(event) => updateDevice(index, { note: event.target.value })} disabled={disabled} />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onSectionChange({ ...section, devices: [...normalizedDevices, {}] })}
        className="inline-flex items-center gap-2 rounded-lg border border-primary-container/30 bg-primary-fixed px-3 py-2 text-xs font-extrabold text-primary-container"
        disabled={disabled}
      >
        <Plus size={14} />
        Thêm camera
      </button>
    </div>
  );
}

function WorkflowSection({
  section,
  value,
  onChange,
  disabled = false,
}: {
  section: WorkflowSectionConfig;
  value: WorkflowData;
  onChange: (value: WorkflowData) => void;
  disabled?: boolean;
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
            <CameraDevicesEditor section={sectionValue} onSectionChange={onSectionChange} disabled={disabled} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(section.fields || []).map((field) => (
                <label key={field.key} className={field.type === "textarea" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                  <span className="text-xs font-bold text-on-surface-variant">{field.label}</span>
                  <WorkflowInput
                    field={field}
                    value={sectionValue[field.key]}
                    onChange={(nextValue) => onSectionChange({ ...sectionValue, [field.key]: nextValue })}
                    disabled={disabled}
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

export function DynamicServiceWorkflowForm({ services, value, onChange, includeSectionKeys, excludeSectionKeys, disabled = false }: Props) {
  const sections = useMemo(
    () => getWorkflowSectionsForServices(services, { includeSectionKeys, excludeSectionKeys }),
    [excludeSectionKeys, includeSectionKeys, services]
  );

  if (sections.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-extrabold text-primary-container">Thông tin nghiệp vụ theo dịch vụ</p>
        <p className="mt-1 text-xs text-on-surface-variant">Chỉ hiện các mục phù hợp với dịch vụ đã chọn.</p>
      </div>
      {sections.map((section) => (
        <WorkflowSection key={section.key} section={section} value={value} onChange={onChange} disabled={disabled} />
      ))}
    </div>
  );
}