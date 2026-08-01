import { normalizeServiceText } from "@/lib/service-categories";

export type WorkerFeatureId =
  | "home"
  | "customers"
  | "create_job"
  | "jobs"
  | "inventory"
  | "sales"
  | "billgo"
  | "chat"
  | "history"
  | "wallet"
  | "profile"
  | "more";

export type WorkerRole = "owner" | "manager" | "technician" | "bill_collector" | "sales_inventory" | "worker" | "admin";

export type WorkerFeatureIconKey =
  | "dashboard"
  | "users"
  | "plus"
  | "package"
  | "cart"
  | "money"
  | "chat"
  | "briefcase"
  | "user"
  | "more";

export type WorkerFeatureDataKey = "billgoHistory" | "billgoAccess";
export type WorkerFeatureFlag = "inventory" | "sales" | "billgo" | "chat" | "history" | "wallet" | "profile";
export type WorkerMenuPlacement = "sidebar" | "mobilePrimary" | "mobileMore";
export type WorkerMenuGroup = "main" | "work" | "commerce" | "communication" | "account" | "more";

export type WorkerFeatureDefinition = {
  id: WorkerFeatureId;
  label: string;
  route: string;
  href: string;
  icon: WorkerFeatureIconKey;
  order: number;
  enabled: boolean;
  placements: WorkerMenuPlacement[];
  group: WorkerMenuGroup;
  roles?: WorkerRole[];
  requiresSpecialty?: boolean;
  specialtyTags?: string[];
  featureFlag?: WorkerFeatureFlag;
  dataConditions?: WorkerFeatureDataKey[];
  accessMode?: "all" | "any";
  exactActive?: boolean;
};

export type WorkerFeatureContext = {
  role: WorkerRole;
  specialties: string[];
  data: Record<WorkerFeatureDataKey, boolean>;
  enabledFeatures?: Partial<Record<WorkerFeatureFlag, boolean>>;
};

const defaultEnabledFeatures: Record<WorkerFeatureFlag, boolean> = {
  inventory: false,
  sales: false,
  billgo: false,
  chat: true,
  history: true,
  wallet: true,
  profile: true,
};

export const workerFeatureRegistry: WorkerFeatureDefinition[] = [
  {
    id: "home",
    label: "Trang chủ",
    route: "/worker",
    href: "/worker",
    icon: "dashboard",
    order: 10,
    enabled: true,
    placements: ["sidebar", "mobilePrimary"],
    group: "main",
    roles: ["owner", "manager", "technician"],
    exactActive: true,
  },
  {
    id: "customers",
    label: "Khách hàng",
    route: "/worker/customers",
    href: "/worker/customers",
    icon: "users",
    order: 20,
    enabled: true,
    placements: ["sidebar", "mobilePrimary"],
    group: "main",
    roles: ["owner", "manager", "technician"],
  },
  {
    id: "create_job",
    label: "Tạo việc",
    route: "/worker",
    href: "/worker#worker-quick-job",
    icon: "plus",
    order: 30,
    enabled: true,
    placements: ["mobilePrimary"],
    group: "work",
    roles: ["owner", "manager", "technician"],
    exactActive: true,
  },
  {
    id: "jobs",
    label: "Tồn việc",
    route: "/worker/jobs",
    href: "/worker/jobs",
    icon: "briefcase",
    order: 40,
    enabled: true,
    placements: ["mobilePrimary"],
    group: "work",
    roles: ["owner", "manager", "technician"],
  },
  {
    id: "billgo",
    label: "Thu Cước",
    route: "/worker/billgo",
    href: "/worker/billgo",
    icon: "money",
    order: 50,
    enabled: true,
    placements: ["sidebar", "mobileMore"],
    group: "commerce",
    roles: ["owner", "manager", "technician", "bill_collector", "sales_inventory", "worker"],
    featureFlag: "billgo",
  },
  {
    id: "inventory",
    label: "Kho hàng",
    route: "/worker/inventory",
    href: "/worker/inventory",
    icon: "package",
    order: 60,
    enabled: true,
    placements: ["sidebar", "mobileMore"],
    group: "commerce",
    roles: ["owner", "manager", "technician", "bill_collector", "sales_inventory", "worker"],
    featureFlag: "inventory",
  },
  {
    id: "sales",
    label: "Bán hàng",
    route: "/worker/sales",
    href: "/worker/sales",
    icon: "cart",
    order: 70,
    enabled: true,
    placements: ["sidebar", "mobileMore"],
    group: "commerce",
    roles: ["owner", "manager", "technician", "bill_collector", "sales_inventory", "worker"],
    featureFlag: "sales",
  },
  {
    id: "chat",
    label: "Chat",
    route: "/worker/chat",
    href: "/worker/chat",
    icon: "chat",
    order: 80,
    enabled: true,
    placements: ["sidebar", "mobileMore"],
    group: "communication",
    roles: ["owner", "manager", "technician"],
    featureFlag: "chat",
  },
  {
    id: "history",
    label: "Lịch sử",
    route: "/worker/history",
    href: "/worker/history",
    icon: "briefcase",
    order: 90,
    enabled: true,
    placements: ["sidebar", "mobileMore"],
    group: "work",
    roles: ["owner", "manager", "technician"],
    featureFlag: "history",
  },
  {
    id: "wallet",
    label: "Ví",
    route: "/worker/wallet",
    href: "/worker/wallet",
    icon: "money",
    order: 100,
    enabled: true,
    placements: ["sidebar", "mobileMore"],
    group: "account",
    roles: ["owner", "manager"],
    featureFlag: "wallet",
  },
  {
    id: "profile",
    label: "Hồ sơ",
    route: "/worker/profile",
    href: "/worker/profile",
    icon: "user",
    order: 110,
    enabled: true,
    placements: ["sidebar", "mobileMore"],
    group: "account",
    roles: ["owner", "manager", "technician", "bill_collector", "sales_inventory", "worker"],
    featureFlag: "profile",
  },
];

const normalizeTag = (value: string) => normalizeServiceText(value).trim();

function matchesSpecialty(feature: WorkerFeatureDefinition, specialties: string[]) {
  if (feature.requiresSpecialty && specialties.length === 0) return false;
  if (!feature.specialtyTags?.length) return !feature.requiresSpecialty || specialties.length > 0;

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

function matchesAccess(feature: WorkerFeatureDefinition, context: WorkerFeatureContext) {
  const checks: boolean[] = [];

  if (feature.specialtyTags?.length || feature.requiresSpecialty) {
    checks.push(matchesSpecialty(feature, context.specialties));
  }

  if (feature.dataConditions?.length) {
    checks.push(matchesDataConditions(feature, context.data));
  }

  if (checks.length === 0) return true;
  return feature.accessMode === "any" ? checks.some(Boolean) : checks.every(Boolean);
}

function matchesFeatureFlag(feature: WorkerFeatureDefinition, enabledFeatures: WorkerFeatureContext["enabledFeatures"]) {
  if (!feature.featureFlag) return true;
  return enabledFeatures?.[feature.featureFlag] ?? defaultEnabledFeatures[feature.featureFlag];
}

function uniqueById(features: WorkerFeatureDefinition[]) {
  return [...new Map(features.map(feature => [feature.id, feature])).values()];
}

export function resolveWorkerFeatures(context: WorkerFeatureContext) {
  return uniqueById(workerFeatureRegistry)
    .filter(feature => feature.enabled)
    .filter(feature => !feature.roles?.length || feature.roles.includes(context.role))
    .filter(feature => matchesFeatureFlag(feature, context.enabledFeatures))
    .filter(feature => matchesAccess(feature, context))
    .sort((a, b) => a.order - b.order);
}

export function resolveWorkerMenuByPlacement(
  context: WorkerFeatureContext,
  placement: WorkerMenuPlacement
) {
  return resolveWorkerFeatures(context).filter(feature => feature.placements.includes(placement));
}
