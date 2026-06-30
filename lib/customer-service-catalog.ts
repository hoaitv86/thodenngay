import {
  type ServiceDisplayCategory,
  type ServiceHierarchyLike,
  groupServicesForDisplay,
} from "@/lib/service-hierarchy";

type PricedServiceHierarchyLike = ServiceHierarchyLike & {
  base_price?: number | string | null;
};

export type CustomerServiceGroup<T extends ServiceHierarchyLike> = {
  category: ServiceDisplayCategory;
  services: T[];
};

const CUSTOMER_SERVICE_GROUPS: Record<string, string[]> = {
  "Mạng Internet": ["Lắp đặt", "Sửa chữa", "Bảo trì", "Di dời"],
  Camera: ["Lắp đặt", "Sửa chữa", "Bảo trì", "Cài đặt"],
  "Máy tính": ["Cài đặt", "Sửa chữa", "Nâng cấp", "Bảo trì"],
  "Máy in": ["Cài đặt", "Sửa chữa", "Đổ mực", "Mực in", "Bảo trì"],
};

const CUSTOMER_SERVICE_LABELS: Record<string, string> = {
  "Mực in": "Đổ mực",
};

const normalize = (value?: string | null) =>
  (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

export const getCustomerServiceDisplayName = <T extends ServiceHierarchyLike>(service: T) =>
  CUSTOMER_SERVICE_LABELS[service.name || ""] || service.name || "Dịch vụ";

export const getCustomerServiceGroups = <T extends ServiceHierarchyLike>(
  services: T[],
): CustomerServiceGroup<T>[] => {
  const displayGroups = groupServicesForDisplay(services);

  return displayGroups
    .map(group => {
      const allowedNames = CUSTOMER_SERVICE_GROUPS[group.category.name] || [];
      const allowed = new Set(allowedNames.map(normalize));
      const customerServices = group.childGroups
        .map(childGroup => childGroup.child)
        .filter(service => allowed.has(normalize(service.name)));

      return {
        category: group.category,
        services: customerServices,
      };
    })
    .filter(group => group.services.length > 0);
};

export const getCustomerServicePathLabel = <T extends ServiceHierarchyLike>(
  service: T | null | undefined,
  services: T[],
) => {
  if (!service) return "";
  const groups = getCustomerServiceGroups(services);
  const group = groups.find(item => item.services.some(groupService => groupService.id === service.id));
  return group ? `${group.category.name} / ${getCustomerServiceDisplayName(service)}` : getCustomerServiceDisplayName(service);
};

export const getCustomerServiceBasePrice = <T extends PricedServiceHierarchyLike>(
  service: T,
  services: T[],
) => {
  const children = services.filter(item => item.parent_service_id === service.id);
  const childPrices = children
    .map(item => Number(item.base_price || 0))
    .filter(price => Number.isFinite(price) && price > 0);

  if (childPrices.length > 0) return Math.min(...childPrices);
  return Number(service.base_price || 0);
};
