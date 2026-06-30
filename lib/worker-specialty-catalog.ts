import { normalizeServiceText } from "@/lib/service-categories";
import { type ServiceHierarchyLike, groupServicesForDisplay } from "@/lib/service-hierarchy";

export type WorkerSpecialtyChild = {
  id: string;
  label: string;
  value: string;
};

export type WorkerSpecialtyGroup = {
  id: string;
  label: string;
  keywords: string[];
  children: WorkerSpecialtyChild[];
};

type ServiceForSpecialty = ServiceHierarchyLike & {
  is_active?: boolean | null;
};

const FALLBACK_GROUPS: WorkerSpecialtyGroup[] = [
  {
    id: "internet",
    label: "Mạng internet",
    keywords: ["mang internet", "internet", "wifi", "wi-fi", "router", "modem", "mesh", "lan", "switch"],
    children: [
      { id: "internet-install", label: "Lắp đặt", value: "Mạng internet / Lắp đặt" },
      { id: "internet-repair", label: "Sửa chữa", value: "Mạng internet / Sửa chữa" },
      { id: "internet-maintenance", label: "Bảo trì", value: "Mạng internet / Bảo trì" },
      { id: "internet-relocation", label: "Di dời", value: "Mạng internet / Di dời" },
    ],
  },
  {
    id: "camera",
    label: "Camera",
    keywords: ["camera", "cctv", "dau ghi", "ghi hinh"],
    children: [
      { id: "camera-install", label: "Lắp đặt", value: "Camera / Lắp đặt" },
      { id: "camera-repair", label: "Sửa chữa", value: "Camera / Sửa chữa" },
      { id: "camera-maintenance", label: "Bảo trì", value: "Camera / Bảo trì" },
      { id: "camera-setup", label: "Cài đặt", value: "Camera / Cài đặt" },
    ],
  },
  {
    id: "computer",
    label: "Máy tính",
    keywords: ["may tinh", "laptop", "pc", "windows", "office", "phan mem", "ram", "ssd"],
    children: [
      { id: "computer-setup", label: "Cài đặt", value: "Máy tính / Cài đặt" },
      { id: "computer-repair", label: "Sửa chữa", value: "Máy tính / Sửa chữa" },
      { id: "computer-upgrade", label: "Nâng cấp", value: "Máy tính / Nâng cấp" },
      { id: "computer-maintenance", label: "Bảo trì", value: "Máy tính / Bảo trì" },
    ],
  },
  {
    id: "printer",
    label: "Máy in",
    keywords: ["may in", "printer", "muc in", "do muc", "scan", "fax"],
    children: [
      { id: "printer-setup", label: "Cài đặt", value: "Máy in / Cài đặt" },
      { id: "printer-repair", label: "Sửa chữa", value: "Máy in / Sửa chữa" },
      { id: "printer-ink", label: "Đổ mực", value: "Máy in / Đổ mực" },
      { id: "printer-maintenance", label: "Bảo trì", value: "Máy in / Bảo trì" },
    ],
  },
  {
    id: "low-voltage",
    label: "Điện nhẹ / thiết bị mạng",
    keywords: ["dien nhe", "thiet bi mang", "cap mang", "day mang", "switch", "router", "wifi", "camera", "nguon"],
    children: [
      { id: "low-voltage-cabling", label: "Đi dây tín hiệu", value: "Điện nhẹ / thiết bị mạng / Đi dây tín hiệu" },
      { id: "low-voltage-network-device", label: "Lắp thiết bị mạng", value: "Điện nhẹ / thiết bị mạng / Lắp thiết bị mạng" },
      { id: "low-voltage-camera-device", label: "Lắp thiết bị camera", value: "Điện nhẹ / thiết bị mạng / Lắp thiết bị camera" },
      { id: "low-voltage-troubleshoot", label: "Xử lý tín hiệu/nguồn", value: "Điện nhẹ / thiết bị mạng / Xử lý tín hiệu/nguồn" },
    ],
  },
  {
    id: "other",
    label: "Khác",
    keywords: ["khac", "sua chua", "bao tri", "lap dat"],
    children: [
      { id: "other-install", label: "Lắp đặt khác", value: "Khác / Lắp đặt" },
      { id: "other-repair", label: "Sửa chữa khác", value: "Khác / Sửa chữa" },
      { id: "other-maintenance", label: "Bảo trì khác", value: "Khác / Bảo trì" },
    ],
  },
];

const ROOT_LABEL_ALIASES: Record<string, string> = {
  "Mạng Internet": "Mạng internet",
};

const CHILD_LABEL_ALIASES: Record<string, string> = {
  "Mực in": "Đổ mực",
};

const normalize = (value?: string | null) => normalizeServiceText(value);

const makeChildValue = (parentLabel: string, childLabel: string) => `${parentLabel} / ${childLabel}`;

const uniqueByValue = (children: WorkerSpecialtyChild[]) => {
  const seen = new Set<string>();
  return children.filter(child => {
    const key = normalize(child.value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildWorkerSpecialtyGroups = (services: ServiceForSpecialty[] = []): WorkerSpecialtyGroup[] => {
  const displayGroups = groupServicesForDisplay(services);
  const serviceGroups = displayGroups.map(group => {
    const fallback = FALLBACK_GROUPS.find(item =>
      normalize(item.label) === normalize(group.category.name) ||
      item.keywords.some(keyword => normalize(group.category.name).includes(normalize(keyword)))
    );

    if (!fallback) return null;

    const parentLabel = ROOT_LABEL_ALIASES[group.category.name] || fallback.label;
    const children = group.childGroups.map(childGroup => {
      const label = CHILD_LABEL_ALIASES[childGroup.child.name || ""] || childGroup.child.name || "Dịch vụ";
      return {
        id: childGroup.child.id,
        label,
        value: makeChildValue(parentLabel, label),
      };
    });

    return {
      ...fallback,
      label: parentLabel,
      children: uniqueByValue(children.length > 0 ? children : fallback.children),
    };
  }).filter((group): group is WorkerSpecialtyGroup => Boolean(group));

  const groupsById = new Map(serviceGroups.map(group => [group.id, group]));
  FALLBACK_GROUPS.forEach(group => {
    if (!groupsById.has(group.id)) groupsById.set(group.id, group);
  });

  return FALLBACK_GROUPS.map(group => groupsById.get(group.id) || group);
};

export const getWorkerSpecialtyGroups = () => FALLBACK_GROUPS;

export const flattenWorkerSpecialtyValues = (groups: WorkerSpecialtyGroup[]) =>
  groups.flatMap(group => [group.label, ...group.children.map(child => child.value)]);

export const inferWorkerSpecialtyParentIds = (
  specialties: string[] = [],
  groups: WorkerSpecialtyGroup[] = FALLBACK_GROUPS,
) => {
  const normalizedSpecialties = specialties.map(normalize).filter(Boolean);
  return groups
    .filter(group =>
      normalizedSpecialties.some(specialty =>
        specialty === normalize(group.label) ||
        specialty.includes(normalize(group.label)) ||
        group.keywords.some(keyword => specialty.includes(normalize(keyword))) ||
        group.children.some(child => {
          const childLabel = normalize(child.label);
          const childValue = normalize(child.value);
          return specialty === childLabel || specialty === childValue || specialty.includes(childValue);
        })
      )
    )
    .map(group => group.id);
};

export const inferWorkerSpecialtyChildValues = (
  specialties: string[] = [],
  groups: WorkerSpecialtyGroup[] = FALLBACK_GROUPS,
) => {
  const normalizedSpecialties = specialties.map(normalize).filter(Boolean);
  return groups.flatMap(group =>
    group.children
      .filter(child => {
        const childLabel = normalize(child.label);
        const childValue = normalize(child.value);
        return normalizedSpecialties.some(specialty =>
          specialty === childLabel ||
          specialty === childValue ||
          specialty.includes(childValue) ||
          (specialty.includes(normalize(group.label)) && specialty.includes(childLabel))
        );
      })
      .map(child => child.value)
  );
};

export const expandWorkerSpecialties = (
  selectedParentIds: string[],
  selectedChildValues: string[],
  groups: WorkerSpecialtyGroup[] = FALLBACK_GROUPS,
  previousSpecialties: string[] = [],
) => {
  const selectedParents = groups
    .filter(group => selectedParentIds.includes(group.id))
    .map(group => group.label);
  const knownValues = new Set(flattenWorkerSpecialtyValues(groups).map(normalize));
  const legacySpecialties = previousSpecialties.filter(specialty => !knownValues.has(normalize(specialty)));

  return Array.from(new Set([...selectedParents, ...selectedChildValues, ...legacySpecialties].map(item => item.trim()).filter(Boolean)));
};
