import { getAllCachedDatasets, getCachedDataset, logOfflineDebug, type OfflineDataset } from "@/lib/offline/cache";
import { makeWorkerDatasetKey, type WorkerOfflineDataset, type WorkerOfflineScope } from "@/lib/offline/worker-data";

export const WORKER_OFFLINE_SHELL_PATHS = [
  "/worker",
  "/worker/jobs",
  "/worker/customers",
  "/worker/billgo",
  "/worker/history",
  "/worker/history/__offline-shell__",
  "/worker/profile",
  "/worker/chat",
  "/worker/inventory",
  "/worker/inventory/new",
  "/worker/inventory/__offline-shell__/edit",
  "/worker/inventory/__offline-shell__/delete",
  "/worker/sales",
  "/worker/sales/new",
  "/worker/wallet",
];

export const WORKER_DETAIL_ROUTE_PATTERNS = [
  /^\/worker\/history\/[^/]+$/,
  /^\/worker\/inventory\/[^/]+\/(edit|delete)$/,
  /^\/worker\/customers\/[^/]+$/,
  /^\/worker\/jobs\/[^/]+$/,
  /^\/worker\/billgo\/[^/]+$/,
];

type CacheMeta = Record<string, unknown> | undefined;

type CachedRecordSearchOptions = {
  dataset: WorkerOfflineDataset;
  userId?: string | null;
  recordId: string;
  scopes?: WorkerOfflineScope[];
  variants?: Array<string | null | undefined>;
};

export type CachedWorkerRecordResult<T> = {
  record: T;
  cacheKey: string;
  dataset: OfflineDataset<unknown>;
};

function keyUserPart(userId?: string | null) {
  return userId ? `:u:${encodeURIComponent(userId)}:` : null;
}

function isWorkerDatasetForUser(row: OfflineDataset<unknown>, dataset: WorkerOfflineDataset, userId?: string | null) {
  const meta = row.meta as CacheMeta;
  const metaDataset = meta?.dataset === dataset;
  const keyDataset = row.key.startsWith(`worker:${dataset}:`);
  if (!metaDataset && !keyDataset) return false;

  if (!userId) return true;
  const metaUserId = typeof meta?.userId === "string" ? meta.userId : null;
  return metaUserId === userId || row.key.includes(keyUserPart(userId) || "");
}

function toRecordArray(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  if (!data || typeof data !== "object") return [];

  const record = data as Record<string, unknown>;
  const arrayKeys = ["rows", "items", "data", "jobs", "workerJobs", "customers", "receivables", "products"];
  return arrayKeys.flatMap((key) => toRecordArray(record[key]));
}

function findRecord<T>(row: OfflineDataset<unknown>, recordId: string): T | null {
  const found = toRecordArray(row.data).find((item) => item.id === recordId);
  return found ? found as T : null;
}

function uniqueScopes(scopes: WorkerOfflineScope[]) {
  const seen = new Set<string>();
  return scopes.filter((scope) => {
    const key = JSON.stringify({ userId: scope.userId, workerId: scope.workerId || null, storeId: scope.storeId || null });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isWorkerDetailRoute(pathname: string) {
  return WORKER_DETAIL_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export async function findCachedWorkerRecordById<T>({
  dataset,
  userId,
  recordId,
  scopes = [],
  variants = [null],
}: CachedRecordSearchOptions): Promise<CachedWorkerRecordResult<T> | null> {
  const scopedKeys = uniqueScopes(scopes).flatMap((scope) =>
    variants.map((variant) => makeWorkerDatasetKey(dataset, scope, variant || null))
  );

  for (const key of scopedKeys) {
    const row = await getCachedDataset<unknown>(key);
    if (!row) continue;
    const record = findRecord<T>(row, recordId);
    if (record) return { record, cacheKey: row.key, dataset: row as OfflineDataset<unknown> };
  }

  const rows = await getAllCachedDatasets();
  for (const row of rows) {
    if (!isWorkerDatasetForUser(row, dataset, userId)) continue;
    const record = findRecord<T>(row, recordId);
    if (record) {
      logOfflineDebug("detail record found by scan", { dataset, cacheKey: row.key, recordId });
      return { record, cacheKey: row.key, dataset: row };
    }
  }

  logOfflineDebug("detail record missing", { dataset, userId: userId || null, recordId, scopedKeyCount: scopedKeys.length });
  return null;
}

function collectIdsFromDataset(row: OfflineDataset<unknown>) {
  return toRecordArray(row.data)
    .map((record) => record.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function collectWorkerOfflineDetailPaths(userId?: string | null) {
  const rows = await getAllCachedDatasets();
  const paths = new Set<string>();

  rows.forEach((row) => {
    if (isWorkerDatasetForUser(row, "jobs", userId)) {
      collectIdsFromDataset(row).forEach((id) => paths.add(`/worker/history/${encodeURIComponent(id)}`));
    }
    if (isWorkerDatasetForUser(row, "inventory", userId)) {
      collectIdsFromDataset(row).forEach((id) => {
        paths.add(`/worker/inventory/${encodeURIComponent(id)}/edit`);
        paths.add(`/worker/inventory/${encodeURIComponent(id)}/delete`);
      });
    }
  });

  logOfflineDebug("worker detail route paths collected", { userId: userId || null, recordCount: paths.size });
  return Array.from(paths);
}
