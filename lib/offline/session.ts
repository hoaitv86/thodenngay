import type { User } from "@supabase/supabase-js";

const OFFLINE_AUTH_USER_KEY = "tdn.offline.auth.user.v1";

type StoredOfflineUser = Pick<User, "id" | "aud" | "role" | "email" | "phone" | "app_metadata" | "user_metadata"> & {
  lastAuthenticatedAt: string;
};

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function rememberOfflineAuthenticatedUser(user?: User | null) {
  if (!user || !canUseBrowserStorage()) return;

  const storedUser: StoredOfflineUser = {
    id: user.id,
    aud: user.aud,
    role: user.role,
    email: user.email,
    phone: user.phone,
    app_metadata: user.app_metadata || {},
    user_metadata: user.user_metadata || {},
    lastAuthenticatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(OFFLINE_AUTH_USER_KEY, JSON.stringify(storedUser));
}

export function forgetOfflineAuthenticatedUser() {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(OFFLINE_AUTH_USER_KEY);
}

export function getOfflineAuthenticatedUser(): User | null {
  if (!canUseBrowserStorage()) return null;

  try {
    const value = window.localStorage.getItem(OFFLINE_AUTH_USER_KEY);
    if (!value) return null;
    const stored = JSON.parse(value) as StoredOfflineUser;
    if (!stored?.id || !stored.lastAuthenticatedAt) return null;

    return {
      ...stored,
      identities: [],
      created_at: stored.lastAuthenticatedAt,
      updated_at: stored.lastAuthenticatedAt,
    } as unknown as User;
  } catch {
    forgetOfflineAuthenticatedUser();
    return null;
  }
}

export function hasOfflineAuthenticatedUser() {
  return Boolean(getOfflineAuthenticatedUser());
}


