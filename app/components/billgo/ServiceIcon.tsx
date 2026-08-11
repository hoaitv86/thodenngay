"use client";

import { CreditCard, Smartphone, Wifi, Zap, type LucideIcon } from "lucide-react";

export type BillGoServiceIconType = "internet" | "mobile" | "electricity" | "installment";

type ServiceIconConfig = {
  label: string;
  Icon: LucideIcon;
  tone: { text: string; bg: string; softBg: string; border: string };
};

export const BILLGO_SERVICE_ICON_CONFIG: Record<BillGoServiceIconType, ServiceIconConfig> = {
  internet: { label: "Internet", Icon: Wifi, tone: { text: "text-blue-600", bg: "bg-blue-600", softBg: "bg-blue-50", border: "border-blue-100" } },
  mobile: { label: "Di \u0111\u1ed9ng", Icon: Smartphone, tone: { text: "text-emerald-600", bg: "bg-emerald-500", softBg: "bg-emerald-50", border: "border-emerald-100" } },
  electricity: { label: "Ti\u1ec1n \u0111i\u1ec7n", Icon: Zap, tone: { text: "text-amber-500", bg: "bg-amber-400", softBg: "bg-amber-50", border: "border-amber-100" } },
  installment: { label: "Tr\u1ea3 g\u00f3p", Icon: CreditCard, tone: { text: "text-rose-500", bg: "bg-rose-500", softBg: "bg-rose-50", border: "border-rose-100" } },
};

export const BILLGO_SERVICE_ICON_TYPES: BillGoServiceIconType[] = ["internet", "mobile", "electricity", "installment"];

export const getBillGoServiceIconType = (value?: string | null): BillGoServiceIconType => {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "d")
    .toLowerCase();
  if (normalized.includes("mobile") || normalized.includes("di dong") || normalized.includes("phone")) return "mobile";
  if (normalized.includes("electric") || normalized.includes("dien")) return "electricity";
  if (normalized.includes("installment") || normalized.includes("tra gop") || normalized.includes("card")) return "installment";
  return "internet";
};

type ServiceIconProps = {
  type?: BillGoServiceIconType | string | null;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  className?: string;
};

const sizeClasses = { sm: "h-7 w-7", md: "h-10 w-10", lg: "h-12 w-12" };
const iconSizes = { sm: 15, md: 20, lg: 24 };

export function ServiceIcon({ type, size = "md", selected = false, className = "" }: ServiceIconProps) {
  const serviceType = getBillGoServiceIconType(type);
  const config = BILLGO_SERVICE_ICON_CONFIG[serviceType];
  const Icon = config.Icon;
  const surface = selected ? config.tone.bg + " text-white" : config.tone.softBg + " " + config.tone.text;
  return (
    <span className={["inline-flex shrink-0 items-center justify-center rounded-full", sizeClasses[size], surface, className].filter(Boolean).join(" ")}>
      <Icon size={iconSizes[size]} strokeWidth={2.4} />
    </span>
  );
}
