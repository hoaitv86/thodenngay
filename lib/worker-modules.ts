import { normalizeServiceText } from "@/lib/service-categories";

export type WorkerModuleKey = "billgo" | "sales";
export type WorkerFeatureModuleFlag = WorkerModuleKey | "inventory";
export type WorkerModuleFlags = Partial<Record<WorkerFeatureModuleFlag, boolean>> | null | undefined;

export type WorkerModuleRole = "owner" | "manager" | "technician" | "bill_collector" | "sales_inventory" | "worker" | "admin";

export type WorkerFeatureModuleState = Record<WorkerFeatureModuleFlag, boolean>;

const internetSpecialtyTokens = ["internet", "mang internet", "wifi", "pppoe"];

function normalizeFlags(flags: unknown): WorkerModuleFlags {
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) return null;
  return flags as WorkerModuleFlags;
}

function normalizeSpecialty(value: string) {
  return normalizeServiceText(value).trim();
}

export function hasInternetWorkerSpecialty(specialties: unknown) {
  if (!Array.isArray(specialties)) return false;
  return specialties.some((item) => {
    if (typeof item !== "string") return false;
    const normalized = normalizeSpecialty(item);
    return internetSpecialtyTokens.some((token) => normalized.includes(token));
  });
}

export function isWorkerModuleEnabled(flags: unknown, key: WorkerFeatureModuleFlag) {
  const normalized = normalizeFlags(flags);
  if (!normalized) return false;

  if (key === "inventory") {
    return Boolean(normalized.inventory || normalized.sales);
  }

  return Boolean(normalized[key]);
}

export function resolveWorkerFeatureModuleState({
  specialties,
}: {
  accountFlags?: unknown;
  unitFlags?: unknown;
  role: WorkerModuleRole;
  specialties?: unknown;
}): WorkerFeatureModuleState {
  return {
    billgo: hasInternetWorkerSpecialty(specialties),
    sales: true,
    inventory: true,
  };
}
