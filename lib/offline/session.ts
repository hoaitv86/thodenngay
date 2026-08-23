import type { User } from "@supabase/supabase-js";
import { isWorkerRole, resolveActiveRole, type AccountRole } from "@/lib/account-roles";

const OFFLINE_AUTH_USER_KEY = "tdn.offline.auth.user.v1";

type StoredOfflineUser = Pick<User, "id" | "aud" | "role" | "email" | "phone" | "app_metadata" | "user_metadata"> & {
  lastAuthenticatedAt: string;
};

type StoredOfflineAuthSnapshot = StoredOfflineUser & {
  destination?: string | null;
  legacyRole?: string | null;
  preferredRole?: string | null;
  worker?: { status?: string | null } | null;
  userRoles?: Array<{ role?: AccountRole | string | null; is_active?: boolean | null }>;
};

export type OfflineAuthSnapshot = {
  user: User;
  destination: string | null;
  legacyRole: string | null;
  preferredRole: string | null;
  worker: { status?: string | null } | null;
  userRoles: Array<{ role?: AccountRole | string | null; is_active?: boolean | null }>;
  lastAuthenticatedAt: string;
};
export type OfflineWorkerAuthSnapshot = OfflineAuthSnapshot & {
  activeRole: AccountRole;
};

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function toStoredUser(user: User, lastAuthenticatedAt = new Date().toISOString()): StoredOfflineUser {
  return {
    id: user.id,
    aud: user.aud,
    role: user.role,
    email: user.email,
    phone: user.phone,
    app_metadata: user.app_metadata || {},
    user_metadata: user.user_metadata || {},
    lastAuthenticatedAt,
  };
}

function toUser(stored: StoredOfflineUser): User {
  return {
    ...stored,
    identities: [],
    created_at: stored.lastAuthenticatedAt,
    updated_at: stored.lastAuthenticatedAt,
  } as unknown as User;
}

function readStoredSnapshot(): StoredOfflineAuthSnapshot | null {
  if (!canUseBrowserStorage()) return null;

  try {
    const value = window.localStorage.getItem(OFFLINE_AUTH_USER_KEY);
    if (!value) return null;
    const stored = JSON.parse(value) as StoredOfflineAuthSnapshot;
    if (!stored?.id || !stored.lastAuthenticatedAt) return null;
    return stored;
  } catch {
    forgetOfflineAuthenticatedUser();
    return null;
  }
}

export function rememberOfflineAuthenticatedUser(user?: User | null) {
  if (!user || !canUseBrowserStorage()) return;

  const previous = readStoredSnapshot();
  const storedUser: StoredOfflineAuthSnapshot = {
    ...previous,
    ...toStoredUser(user),
  };

  window.localStorage.setItem(OFFLINE_AUTH_USER_KEY, JSON.stringify(storedUser));
}

export function rememberOfflineAuthSnapshot({
  user,
  destination,
  legacyRole,
  preferredRole,
  worker,
  userRoles,
}: {
  user?: User | null;
  destination?: string | null;
  legacyRole?: string | null;
  preferredRole?: string | null;
  worker?: { status?: string | null } | null;
  userRoles?: Array<{ role?: AccountRole | string | null; is_active?: boolean | null }> | null;
}) {
  if (!user || !canUseBrowserStorage()) return;

  const storedUser: StoredOfflineAuthSnapshot = {
    ...toStoredUser(user),
    destination: destination || null,
    legacyRole: legacyRole || null,
    preferredRole: preferredRole || null,
    worker: worker || null,
    userRoles: userRoles || [],
  };

  window.localStorage.setItem(OFFLINE_AUTH_USER_KEY, JSON.stringify(storedUser));
}

export function forgetOfflineAuthenticatedUser() {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(OFFLINE_AUTH_USER_KEY);
}

export function getOfflineAuthenticatedUser(): User | null {
  const stored = readStoredSnapshot();
  if (!stored) return null;
  return toUser(stored);
}

export function getOfflineAuthSnapshot(): OfflineAuthSnapshot | null {
  const stored = readStoredSnapshot();
  if (!stored) return null;

  return {
    user: toUser(stored),
    destination: stored.destination || null,
    legacyRole: stored.legacyRole || null,
    preferredRole: stored.preferredRole || null,
    worker: stored.worker || null,
    userRoles: stored.userRoles || [],
    lastAuthenticatedAt: stored.lastAuthenticatedAt,
  };
}

export function getOfflineWorkerAuthSnapshot(): OfflineWorkerAuthSnapshot | null {
  const snapshot = getOfflineAuthSnapshot();
  if (!snapshot) return null;

  const activeRole = resolveActiveRole({
    legacyRole: snapshot.legacyRole,
    worker: snapshot.worker,
    userRoles: snapshot.userRoles,
    preferredRole: snapshot.preferredRole,
  });

  if (!isWorkerRole(activeRole)) return null;
  return { ...snapshot, activeRole };
}
export function hasOfflineAuthenticatedUser() {
  return Boolean(getOfflineAuthenticatedUser());
}
