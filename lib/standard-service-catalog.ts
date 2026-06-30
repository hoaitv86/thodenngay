import { getCanonicalServiceCategory } from "@/lib/service-categories";
import { type ServiceHierarchyLike, hasDatabaseServiceHierarchy } from "@/lib/service-hierarchy";

export const STANDARD_SERVICE_ROOT_IDS = [
  "77a036fc-646c-43e5-87cb-40e02c0d1e9e",
  "11111111-0000-0000-0000-000000000003",
  "c33238ad-121d-4315-aacd-b4f361cb8ad9",
  "1267f766-5082-4287-a5e9-a2c475753275",
] as const;

export const STANDARD_SERVICE_GROUP_IDS = [
  "2fef3daa-db2b-510d-9b82-08ac4cc16b04",
  "1f6bc129-48bc-5441-9a77-3da3528eb7c6",
  "7a0962eb-ff73-5121-865d-08f30a1a0126",
  "0e63e436-ddbd-58e8-8d92-76f9c5e4bf0b",
  "e48b8aa4-0023-5668-a06d-17114bb14fac",
  "95fd5d41-d088-5f07-9264-8329f4e6c753",
  "7881f32a-24d8-5e84-94ae-fe80cc4f23ac",
  "ad4b6acf-7505-5ff6-8c2d-868fb0a42288",
  "f0478a95-4da9-5b63-b96e-c6c0af1d8ed8",
  "61400a30-fdad-5597-8676-51d956ab680c",
  "c0c7b1e4-6b77-5035-b342-ab329b174eff",
  "a194fa71-c2ee-5bbf-8b8b-1bae387971c2",
  "4cd5389b-d046-5cc1-8d8f-6e26fd9fbecd",
  "a819450f-80ce-5a03-8345-e79bed397532",
  "b7e9a90a-55c4-5495-9c72-6615e0e80b27",
  "e3d9f919-5251-58e8-af99-20250fb2e071",
  "9d031261-3cd9-5920-9da4-1fe6eee0565d",
  "a063097a-0156-5d6d-9013-0ac678df6814",
  "05feb2e9-3d0f-5898-afdd-f24cc72c0f08",
  "d59f92fe-77f9-5809-8539-773245b39795",
  "1b366120-97a8-58b6-9ed4-45918f0edfc1",
  "55d7fb55-e983-5c8e-b4b0-7a3524a46e45",
] as const;

export const LEGACY_SERVICE_FALLBACK_ID = "5aea9d65-16ad-49c7-865a-9ffb8fa69a6f";

export const LEGACY_SERVICE_TARGET_BY_ID: Record<string, string> = {
  "a5c8c925-61e7-4e7d-af96-17b20178a1f3": "4cd5389b-d046-5cc1-8d8f-6e26fd9fbecd",
  "52ce8019-a542-4823-b76b-d9329c58636e": "7881f32a-24d8-5e84-94ae-fe80cc4f23ac",
  "d5d17121-1845-4103-8efb-793daeda7b8e": "4cd5389b-d046-5cc1-8d8f-6e26fd9fbecd",
  "a0dcc00b-fb8c-46c8-957c-9f73d4b14907": "4cd5389b-d046-5cc1-8d8f-6e26fd9fbecd",
  "0ebd7f89-db56-428e-9b6a-eb46d2cdf453": LEGACY_SERVICE_FALLBACK_ID,
  "d6961b57-f766-4990-bf45-7fe1e77592c7": "c0c7b1e4-6b77-5035-b342-ab329b174eff",
  "11111111-0000-0000-0000-000000000004": LEGACY_SERVICE_FALLBACK_ID,
  "11111111-0000-0000-0000-000000000001": LEGACY_SERVICE_FALLBACK_ID,
  "4082c7c6-993c-4887-8dd8-15b83f529e4c": LEGACY_SERVICE_FALLBACK_ID,
  "507c86a0-3ff5-473f-9db2-05d15285e0d3": LEGACY_SERVICE_FALLBACK_ID,
  "3032e970-0f7d-41cc-9a16-cde8059ec82d": LEGACY_SERVICE_FALLBACK_ID,
  "f271655a-98ed-40a8-9688-b41923d5af92": "1b366120-97a8-58b6-9ed4-45918f0edfc1",
  "35c4c1b5-fa59-4e49-92be-5b6ae47b609d": "2fef3daa-db2b-510d-9b82-08ac4cc16b04",
  "3b2657a3-8e24-4564-b916-5000bb383708": "95fd5d41-d088-5f07-9264-8329f4e6c753",
  "aa6ee17d-6d94-466e-9d1c-3f916442d831": "95fd5d41-d088-5f07-9264-8329f4e6c753",
  "a8264a9f-fa6d-4794-a556-6279a1dddcf9": "95fd5d41-d088-5f07-9264-8329f4e6c753",
  "ffbb1b41-559b-477b-af5f-a7790b934eb8": "2fef3daa-db2b-510d-9b82-08ac4cc16b04",
  "19df5ce0-d7cb-4a45-9d7a-ef5c3279797a": "4cd5389b-d046-5cc1-8d8f-6e26fd9fbecd",
  "fafe89b7-c90f-423c-9241-a49fa5037e33": "2fef3daa-db2b-510d-9b82-08ac4cc16b04",
  "4b87c63d-1453-4061-9e22-44393f264dcd": "05feb2e9-3d0f-5898-afdd-f24cc72c0f08",
  "708461de-4e36-4b5f-8a74-660b25f36cb8": "1f6bc129-48bc-5441-9a77-3da3528eb7c6",
  "e8924bfb-3df5-4374-89db-0a239346f74a": "a063097a-0156-5d6d-9013-0ac678df6814",
  "cbd266f1-69db-4fb7-a04e-376a36d3d3bd": "1f6bc129-48bc-5441-9a77-3da3528eb7c6",
  "11111111-0000-0000-0000-000000000002": LEGACY_SERVICE_FALLBACK_ID,
  "76371990-f505-4e5d-b252-85e7c23a3647": "e3d9f919-5251-58e8-af99-20250fb2e071",
  "ef7bc117-3784-43a8-a86d-db655722bbd5": LEGACY_SERVICE_FALLBACK_ID,
  "3da05a7e-e4c3-4253-938a-a71e152c5b2b": LEGACY_SERVICE_FALLBACK_ID,
  "6ed74dc6-a075-466a-be67-6c2589d61a03": "ad4b6acf-7505-5ff6-8c2d-868fb0a42288",
  "f92bdc0f-39c4-4927-9154-c947ebf8de84": "1f6bc129-48bc-5441-9a77-3da3528eb7c6",
  "a1584915-6839-47f9-a291-04eca378658d": "1f6bc129-48bc-5441-9a77-3da3528eb7c6",
  "382d1f31-62c3-42f5-9d1f-e0cde03bfd3a": "a819450f-80ce-5a03-8345-e79bed397532",
  "1d88b000-cced-4fec-a79a-d323adb0b50d": "a819450f-80ce-5a03-8345-e79bed397532",
  "37707a2b-cd38-4a2b-ad69-f2833c4536bf": "a819450f-80ce-5a03-8345-e79bed397532",
  "240a3b4c-e3b6-48af-9d09-4f91af494c89": "1b366120-97a8-58b6-9ed4-45918f0edfc1",
  "4803d1e4-9f46-4da3-8f83-86502dc7a4d8": "1b366120-97a8-58b6-9ed4-45918f0edfc1",
  "9d5a7a8e-9c50-4536-8850-070eeee8df4d": "61400a30-fdad-5597-8676-51d956ab680c",
  "19c6c7eb-5b47-447b-9efd-f66548d832fb": "ad4b6acf-7505-5ff6-8c2d-868fb0a42288",
  "0a6faf96-1f87-48a1-9279-14d58ac68a27": "61400a30-fdad-5597-8676-51d956ab680c",
  "f2a99a2b-cfd1-4e82-9b52-1d81fecf6344": "1b366120-97a8-58b6-9ed4-45918f0edfc1",
  "679ab207-49a3-4252-a6e7-be166cf41d34": LEGACY_SERVICE_FALLBACK_ID,
  "7015fa60-406d-433a-b5cb-24f8c6b638cf": "2fef3daa-db2b-510d-9b82-08ac4cc16b04",
  "aed8beb6-a4e0-4a0a-bd12-7dbc9eb4536c": "2fef3daa-db2b-510d-9b82-08ac4cc16b04",
  "faa03d76-3031-4c2a-80d0-77dc3529d534": "1f6bc129-48bc-5441-9a77-3da3528eb7c6",
  "2af66223-a6cb-4a5d-8750-404df588757e": LEGACY_SERVICE_FALLBACK_ID,
  "487e7f4b-fa84-4cba-88b9-3e1707e1432f": "a194fa71-c2ee-5bbf-8b8b-1bae387971c2",
};

const STANDARD_ROOT_SET = new Set<string>(STANDARD_SERVICE_ROOT_IDS);
const LEGACY_SERVICE_SET = new Set<string>(Object.keys(LEGACY_SERVICE_TARGET_BY_ID));

export const isLegacyServiceId = (serviceId?: string | null) =>
  Boolean(serviceId && LEGACY_SERVICE_SET.has(serviceId));

export const getLegacyServiceTargetId = (serviceId?: string | null) =>
  serviceId ? LEGACY_SERVICE_TARGET_BY_ID[serviceId] || null : null;

export const isStandardServiceCatalogNode = <T extends ServiceHierarchyLike>(
  service: T,
  services: T[],
) => {
  if (isLegacyServiceId(service.id)) return false;
  if (!hasDatabaseServiceHierarchy(services)) return Boolean(getCanonicalServiceCategory(service));

  const serviceById = new Map(services.map(item => [item.id, item]));
  let current: T | undefined = service;
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    if (STANDARD_ROOT_SET.has(current.id)) return true;
    if (isLegacyServiceId(current.id)) return false;
    visited.add(current.id);
    current = current.parent_service_id ? serviceById.get(current.parent_service_id) : undefined;
  }

  return false;
};

export const filterStandardServiceCatalog = <T extends ServiceHierarchyLike>(services: T[]) =>
  services.filter(service => isStandardServiceCatalogNode(service, services));
