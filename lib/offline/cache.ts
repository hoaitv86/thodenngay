const OFFLINE_DB_NAME = "tho-den-ngay-offline";
const OFFLINE_DB_VERSION = 1;
const DATASET_STORE = "datasets";

export type OfflineDataset<T> = {
  key: string;
  data: T;
  updatedAt: string;
  meta?: Record<string, unknown>;
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
