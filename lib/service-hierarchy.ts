import {
  type CanonicalServiceCategory,
  type ServiceLike,
  getCanonicalServiceCategory,
  groupServicesByCanonicalCategory,
} from "@/lib/service-categories";

export type ServiceHierarchyLike = ServiceLike & {
  id: string;
  name?: string | null;
  parent_service_id?: string | null;
};

export type ServiceDisplayCategory = Pick<CanonicalServiceCategory, "id" | "name" | "emoji" | "icon">;

export type ServiceDisplayGroup<T extends ServiceHierarchyLike> = {
  category: ServiceDisplayCategory;
  services: T[];
  directServices: T[];
  childGroups: Array<{
    child: T;
    services: T[];
  }>;
};

const DEFAULT_SERVICE_PARENT_BY_ID: Record<string, string> = {
  "3b2657a3-8e24-4564-b916-5000bb383708": "11111111-0000-0000-0000-000000000003",
  "f92bdc0f-39c4-4927-9154-c947ebf8de84": "11111111-0000-0000-0000-000000000003",
  "aa6ee17d-6d94-466e-9d1c-3f916442d831": "3b2657a3-8e24-4564-b916-5000bb383708",
  "a8264a9f-fa6d-4794-a556-6279a1dddcf9": "3b2657a3-8e24-4564-b916-5000bb383708",
  "52ce8019-a542-4823-b76b-d9329c58636e": "f92bdc0f-39c4-4927-9154-c947ebf8de84",
  "d6961b57-f766-4990-bf45-7fe1e77592c7": "f92bdc0f-39c4-4927-9154-c947ebf8de84",
  "9d5a7a8e-9c50-4536-8850-070eeee8df4d": "f92bdc0f-39c4-4927-9154-c947ebf8de84",
  "19c6c7eb-5b47-447b-9efd-f66548d832fb": "f92bdc0f-39c4-4927-9154-c947ebf8de84",
  "0a6faf96-1f87-48a1-9279-14d58ac68a27": "f92bdc0f-39c4-4927-9154-c947ebf8de84",
  "487e7f4b-fa84-4cba-88b9-3e1707e1432f": "f92bdc0f-39c4-4927-9154-c947ebf8de84",
  "6ed74dc6-a075-466a-be67-6c2589d61a03": "c33238ad-121d-4315-aacd-b4f361cb8ad9",
  "a5c8c925-61e7-4e7d-af96-17b20178a1f3": "c33238ad-121d-4315-aacd-b4f361cb8ad9",
  "679ab207-49a3-4252-a6e7-be166cf41d34": "c33238ad-121d-4315-aacd-b4f361cb8ad9",
  "382d1f31-62c3-42f5-9d1f-e0cde03bfd3a": "6ed74dc6-a075-466a-be67-6c2589d61a03",
  "37707a2b-cd38-4a2b-ad69-f2833c4536bf": "6ed74dc6-a075-466a-be67-6c2589d61a03",
  "1d88b000-cced-4fec-a79a-d323adb0b50d": "6ed74dc6-a075-466a-be67-6c2589d61a03",
  "f271655a-98ed-40a8-9688-b41923d5af92": "1267f766-5082-4287-a5e9-a2c475753275",
  "240a3b4c-e3b6-48af-9d09-4f91af494c89": "f271655a-98ed-40a8-9688-b41923d5af92",
  "4803d1e4-9f46-4da3-8f83-86502dc7a4d8": "f271655a-98ed-40a8-9688-b41923d5af92",
  "f2a99a2b-cfd1-4e82-9b52-1d81fecf6344": "f271655a-98ed-40a8-9688-b41923d5af92",
  "ffbb1b41-559b-477b-af5f-a7790b934eb8": "77a036fc-646c-43e5-87cb-40e02c0d1e9e",
  "7015fa60-406d-433a-b5cb-24f8c6b638cf": "77a036fc-646c-43e5-87cb-40e02c0d1e9e",
  "a1584915-6839-47f9-a291-04eca378658d": "77a036fc-646c-43e5-87cb-40e02c0d1e9e",
  "3939f5ad-6561-4ce5-8468-4efc6e50bc33": "ffbb1b41-559b-477b-af5f-a7790b934eb8",
  "aed8beb6-a4e0-4a0a-bd12-7dbc9eb4536c": "7015fa60-406d-433a-b5cb-24f8c6b638cf",
  "faa03d76-3031-4c2a-80d0-77dc3529d534": "a1584915-6839-47f9-a291-04eca378658d",
  "cbd266f1-69db-4fb7-a04e-376a36d3d3bd": "a1584915-6839-47f9-a291-04eca378658d",
  "fafe89b7-c90f-423c-9241-a49fa5037e33": "a1584915-6839-47f9-a291-04eca378658d",
};

const ROOT_SERVICE_ORDER: Record<string, number> = {
  "Mạng Internet": 1,
  Camera: 2,
  "Máy tính": 3,
  "Máy in": 4,
};

const CHILD_SERVICE_ORDER: Record<string, number> = {
  "Lắp đặt": 1,
  "Cài đặt": 2,
  "Sửa chữa": 3,
  "Bảo trì": 4,
  "Nâng cấp": 5,
  "Di dời": 6,
  "Tài khoản": 7,
  "Mực in": 8,
  "Linh kiện": 9,
  "Dữ liệu": 10,
};

const getSortOrder = (name?: string | null, orderMap: Record<string, number> = {}) =>
  name ? orderMap[name] || Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;

const compareByName = <T extends ServiceHierarchyLike>(a: T, b: T) =>
  (a.name || "").localeCompare(b.name || "", "vi");

const compareRoots = <T extends ServiceHierarchyLike>(a: T, b: T) =>
  getSortOrder(a.name, ROOT_SERVICE_ORDER) - getSortOrder(b.name, ROOT_SERVICE_ORDER) || compareByName(a, b);

const compareChildren = <T extends ServiceHierarchyLike>(a: T, b: T) =>
  getSortOrder(a.name, CHILD_SERVICE_ORDER) - getSortOrder(b.name, CHILD_SERVICE_ORDER) || compareByName(a, b);

export const getDefaultServiceParentId = (serviceId: string) =>
  DEFAULT_SERVICE_PARENT_BY_ID[serviceId] || null;

export const applyDefaultServiceParents = <T extends ServiceHierarchyLike>(services: T[]) => {
  const serviceIds = new Set(services.map(service => service.id));
  return services.map(service => {
    const parentId = service.parent_service_id || DEFAULT_SERVICE_PARENT_BY_ID[service.id] || null;
    return {
      ...service,
      parent_service_id: parentId && serviceIds.has(parentId) ? parentId : null,
    };
  });
};

const getHierarchyMaps = <T extends ServiceHierarchyLike>(services: T[]) => {
  const serviceById = new Map(services.map(service => [service.id, service]));
  const childrenByParent = new Map<string, T[]>();

  services.forEach(service => {
    if (!service.parent_service_id || !serviceById.has(service.parent_service_id)) return;
    const siblings = childrenByParent.get(service.parent_service_id) || [];
    siblings.push(service);
    childrenByParent.set(service.parent_service_id, siblings);
  });

  return { serviceById, childrenByParent };
};

export const hasDatabaseServiceHierarchy = <T extends ServiceHierarchyLike>(services: T[]) => {
  const serviceIds = new Set(services.map(service => service.id));
  return services.some(service => Boolean(service.parent_service_id && serviceIds.has(service.parent_service_id)));
};

const getLeafDescendants = <T extends ServiceHierarchyLike>(
  serviceId: string,
  childrenByParent: Map<string, T[]>,
): T[] => {
  const children = childrenByParent.get(serviceId) || [];
  if (children.length === 0) return [];

  return children.flatMap(child => {
    const descendants = getLeafDescendants(child.id, childrenByParent);
    return descendants.length > 0 ? descendants : [child];
  });
};

export const groupServicesByDatabaseHierarchy = <T extends ServiceHierarchyLike>(
  services: T[],
): ServiceDisplayGroup<T>[] => {
  const { serviceById, childrenByParent } = getHierarchyMaps(services);
  const roots = services
    .filter(service => !service.parent_service_id || !serviceById.has(service.parent_service_id))
    .sort(compareRoots);

  return roots
    .map(root => {
      const children = [...(childrenByParent.get(root.id) || [])].sort(compareChildren);
      const directServices = children.length === 0
        ? [root]
        : children
          .filter(child => !childrenByParent.has(child.id))
          .sort(compareByName);
      const childGroups = children
        .filter(child => childrenByParent.has(child.id))
        .map(child => ({
          child,
          services: getLeafDescendants(child.id, childrenByParent).sort(compareByName),
        }))
        .filter(group => group.services.length > 0);
      const servicesInGroup = [...directServices, ...childGroups.flatMap(group => group.services)].sort(compareByName);

      return {
        category: {
          id: root.id,
          name: root.name || "Danh muc",
          emoji: "",
          icon: root.icon || "BriefcaseIcon",
        },
        services: servicesInGroup,
        directServices,
        childGroups,
      };
    })
    .filter(group => group.services.length > 0);
};

export const groupServicesForDisplay = <T extends ServiceHierarchyLike>(
  services: T[],
): ServiceDisplayGroup<T>[] => {
  if (hasDatabaseServiceHierarchy(services)) {
    return groupServicesByDatabaseHierarchy(services);
  }

  return groupServicesByCanonicalCategory(services).map(group => ({
    category: group.category,
    services: [...group.services].sort(compareByName),
    directServices: [...group.services].sort(compareByName),
    childGroups: [],
  }));
};

export const getSelectableServices = <T extends ServiceHierarchyLike>(services: T[]) => {
  if (!hasDatabaseServiceHierarchy(services)) return [...services].sort(compareByName);

  const { childrenByParent } = getHierarchyMaps(services);
  return services
    .filter(service => !childrenByParent.has(service.id))
    .sort(compareByName);
};

export const getServicePathLabel = <T extends ServiceHierarchyLike>(service: T, services: T[]) => {
  const serviceById = new Map(services.map(item => [item.id, item]));
  const names = [service.name || "Dich vu"];
  const visited = new Set<string>([service.id]);
  let parentId = service.parent_service_id || null;

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = serviceById.get(parentId);
    if (!parent) break;
    names.unshift(parent.name || "Danh muc");
    parentId = parent.parent_service_id || null;
  }

  return names.join(" / ");
};

export const getServiceDisplayCategoryId = <T extends ServiceHierarchyLike>(services: T[], serviceId: string) => {
  const serviceById = new Map(services.map(item => [item.id, item]));
  const service = serviceById.get(serviceId);
  if (!service) return "";

  if (!hasDatabaseServiceHierarchy(services)) {
    return getCanonicalServiceCategory(service)?.id || "";
  }

  let current = service;
  const visited = new Set<string>([current.id]);
  while (current.parent_service_id && !visited.has(current.parent_service_id)) {
    const parent = serviceById.get(current.parent_service_id);
    if (!parent) break;
    current = parent;
    visited.add(current.id);
  }

  return current.id;
};
