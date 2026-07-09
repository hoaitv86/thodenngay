export type WorkerFeatureId =
  | "jobs"
  | "customers"
  | "billgo"
  | "chat"
  | "history"
  | "wallet"
  | "profile";

export type WorkerRole = "worker" | "lead_worker" | "assistant_worker" | "admin";

export type WorkerFeatureIconKey =
  | "dashboard"
  | "users"
  | "money"
  | "chat"
  | "briefcase"
  | "user";

export type WorkerFeatureDataKey = "billgoHistory";

export type WorkerFeatureDefinition = {
  id: WorkerFeatureId;
  label: string;
  href: string;
  icon: WorkerFeatureIconKey;
  order: number;
  enabled: boolean;
  roles?: WorkerRole[];
  specialtyTags?: string[];
  dataConditions?: WorkerFeatureDataKey[];
};

export type WorkerFeatureContext = {
  role: WorkerRole;
  specialties: string[];
  data: Record<WorkerFeatureDataKey, boolean>;
};

export const workerFeatureRegistry: WorkerFeatureDefinition[] = [
  {
    id: "jobs",
    label: "Việc làm",
    href: "/worker",
    icon: "dashboard",
    order: 10,
    enabled: true,
    roles: ["worker", "lead_worker", "assistant_worker"],
  },
  {
    id: "customers",
    label: "Khách hàng",
    href: "/worker/customers",
    icon: "users",
    order: 20,
    enabled: true,
    roles: ["worker", "lead_worker", "assistant_worker"],
  },
  {
    id: "billgo",
    label: "BillGo",
    href: "/worker/billgo",
    icon: "money",
    order: 30,
    enabled: true,
    roles: ["worker", "lead_worker"],
    dataConditions: ["billgoHistory"],
  },
  {
    id: "chat",
    label: "Chat",
    href: "/worker/chat",
    icon: "chat",
    order: 40,
    enabled: true,
    roles: ["worker", "lead_worker", "assistant_worker"],
  },
  {
    id: "history",
    label: "Lịch sử",
    href: "/worker/history",
    icon: "briefcase",
    order: 50,
    enabled: true,
    roles: ["worker", "lead_worker", "assistant_worker"],
  },
  {
    id: "wallet",
    label: "Ví",
    href: "/worker/wallet",
    icon: "money",
    order: 60,
    enabled: true,
    roles: ["worker", "lead_worker"],
  },
  {
    id: "profile",
    label: "Hồ sơ",
    href: "/worker/profile",
    icon: "user",
    order: 70,
    enabled: true,
    roles: ["worker", "lead_worker", "assistant_worker"],
  },
];

const normalizeTag = (value: string) => value.trim().toLocaleLowerCase("vi");

function matchesSpecialty(feature: WorkerFeatureDefinition, specialties: string[]) {
  if (!feature.specialtyTags?.length) return true;
  const normalizedSpecialties = specialties.map(normalizeTag);

  return feature.specialtyTags.some(tag => {
    const normalizedTag = normalizeTag(tag);
    return normalizedSpecialties.some(specialty => specialty.includes(normalizedTag));
  });
}

function matchesDataConditions(feature: WorkerFeatureDefinition, data: WorkerFeatureContext["data"]) {
  if (!feature.dataConditions?.length) return true;
  return feature.dataConditions.some(condition => data[condition]);
}

export function resolveWorkerFeatures(context: WorkerFeatureContext) {
  return workerFeatureRegistry
    .filter(feature => feature.enabled)
    .filter(feature => !feature.roles?.length || feature.roles.includes(context.role))
    .filter(feature => matchesSpecialty(feature, context.specialties))
    .filter(feature => matchesDataConditions(feature, context.data))
    .sort((a, b) => a.order - b.order);
}
