export type WorkerOfflineDataset =
  | 'worker-profile'
  | 'store'
  | 'jobs'
  | 'customers'
  | 'billgo'
  | 'categories'
  | 'inventory'
  | 'monthly-goals'
  | 'dashboard-summary'
  | 'areas'
  | 'packages'
  | 'sales';

export type WorkerOfflineScope = {
  userId: string;
  workerId?: string | null;
  storeId?: string | null;
};

const safeKeyPart = (value?: string | null) =>
  encodeURIComponent(value && value.trim() ? value.trim() : 'none');

export function getWorkerStoreId(storeId?: string | null) {
  return storeId && storeId.trim() ? storeId : 'default';
}

export function makeWorkerDatasetKey(
  dataset: WorkerOfflineDataset,
  scope: WorkerOfflineScope,
  variant?: string | null,
) {
  const key = [
    'worker',
    dataset,
    'u:' + safeKeyPart(scope.userId),
    'w:' + safeKeyPart(scope.workerId),
    's:' + safeKeyPart(getWorkerStoreId(scope.storeId)),
  ];

  if (variant) key.push('v:' + safeKeyPart(variant));
  return key.join(':');
}

export function makeWorkerUserDatasetKey(
  dataset: WorkerOfflineDataset,
  userId: string,
  variant?: string | null,
) {
  return makeWorkerDatasetKey(dataset, { userId, workerId: 'pending', storeId: 'default' }, variant);
}

export function isBrowserOffline() {
  return typeof window !== 'undefined' && !window.navigator.onLine;
}
