const OFFLINE_DB_NAME = "tho-den-ngay-offline";
const OFFLINE_DB_VERSION = 2;
const DATASET_STORE = "datasets";
const MUTATION_STORE = "mutations";

export type OfflineDataset<T> = {
  key: string;
  data: T;
  updatedAt: string;
  meta?: Record<string, unknown>;
};

export type OfflineMutationStatus = "pending" | "syncing" | "synced" | "error";

export type OfflineMutation = {
  id: string;
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  module: string;
  entityId?: string | null;
  status: OfflineMutationStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string | null;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openOfflineDb() {
  if (!hasIndexedDb()) return Promise.reject(new Error("IndexedDB không khả dụng."));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DATASET_STORE)) {
        db.createObjectStore(DATASET_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(MUTATION_STORE)) {
        const mutationStore = db.createObjectStore(MUTATION_STORE, { keyPath: "id" });
        mutationStore.createIndex("status", "status", { unique: false });
        mutationStore.createIndex("module", "module", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Không mở được cache offline."));
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Không thao tác được cache offline."));
  });
}

export async function getCachedDataset<T>(key: string): Promise<OfflineDataset<T> | null> {
  if (!hasIndexedDb()) return null;
  const db = await openOfflineDb();
  const transaction = db.transaction(DATASET_STORE, "readonly");
  const store = transaction.objectStore(DATASET_STORE);
  const result = await requestToPromise<OfflineDataset<T> | undefined>(store.get(key));
  return result || null;
}

export async function setCachedDataset<T>(key: string, data: T, meta?: Record<string, unknown>) {
  if (!hasIndexedDb()) return;
  const db = await openOfflineDb();
  const transaction = db.transaction(DATASET_STORE, "readwrite");
  const store = transaction.objectStore(DATASET_STORE);
  await requestToPromise(store.put({ key, data, meta, updatedAt: new Date().toISOString() }));
}

export function isLikelyOfflineError(error: unknown) {
  if (typeof window !== "undefined" && !window.navigator.onLine) return true;
  const message = error instanceof Error ? error.message : String(error || "");
  return /Failed to fetch|NetworkError|Load failed|fetch/i.test(message);
}


export async function enqueueOfflineMutation(input: Omit<OfflineMutation, "status" | "attempts" | "createdAt" | "updatedAt">) {
  if (!hasIndexedDb()) return null;
  const now = new Date().toISOString();
  const mutation: OfflineMutation = {
    ...input,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    lastError: null,
  };
  const db = await openOfflineDb();
  const transaction = db.transaction(MUTATION_STORE, "readwrite");
  await requestToPromise(transaction.objectStore(MUTATION_STORE).put(mutation));
  return mutation;
}

export async function getOfflineMutations(statuses: OfflineMutationStatus[] = ["pending", "error"]) {
  if (!hasIndexedDb()) return [] as OfflineMutation[];
  const db = await openOfflineDb();
  const transaction = db.transaction(MUTATION_STORE, "readonly");
  const rows = await requestToPromise<OfflineMutation[]>(transaction.objectStore(MUTATION_STORE).getAll());
  return rows
    .filter((mutation) => statuses.includes(mutation.status))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function updateOfflineMutation(id: string, patch: Partial<OfflineMutation>) {
  if (!hasIndexedDb()) return null;
  const db = await openOfflineDb();
  const transaction = db.transaction(MUTATION_STORE, "readwrite");
  const store = transaction.objectStore(MUTATION_STORE);
  const current = await requestToPromise<OfflineMutation | undefined>(store.get(id));
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await requestToPromise(store.put(next));
  return next;
}

export async function syncOfflineMutations() {
  if (typeof window !== "undefined" && !window.navigator.onLine) return { synced: 0, failed: 0 };
  const mutations = await getOfflineMutations(["pending", "error"]);
  let synced = 0;
  let failed = 0;

  for (const mutation of mutations) {
    await updateOfflineMutation(mutation.id, { status: "syncing", attempts: mutation.attempts + 1, lastError: null });
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers || { "Content-Type": "application/json" },
        body: mutation.body === undefined ? undefined : JSON.stringify(mutation.body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Đồng bộ thất bại (${response.status}).`);
      await updateOfflineMutation(mutation.id, { status: "synced", lastError: null });
      synced += 1;
    } catch (error) {
      await updateOfflineMutation(mutation.id, {
        status: "error",
        lastError: error instanceof Error ? error.message : "Không thể đồng bộ dữ liệu offline.",
      });
      failed += 1;
    }
  }

  if (typeof window !== "undefined" && (synced > 0 || failed > 0)) {
    window.dispatchEvent(new CustomEvent("tdn:offline-sync-complete", { detail: { synced, failed } }));
  }

  return { synced, failed };
}
