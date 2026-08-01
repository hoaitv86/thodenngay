#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const LEGACY_ADMIN_EMAIL = "admin@alotho.local";
const ADMIN_MODULES = ["workers", "customers", "jobs", "services", "billgo", "sales", "content", "analytics"];

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function uniqueById(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row?.id) map.set(row.id, row);
  }
  return [...map.values()];
}

async function findAuthUserByEmail(supabase, email) {
  const normalizedEmail = email.toLowerCase();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === normalizedEmail);
    if (user) return user;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function getProfile(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status, is_super_admin, requires_password_change")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function findLegacyAdminCandidates(supabase) {
  const explicitUserId = process.env.RESTORE_LEGACY_ADMIN_USER_ID?.trim();
  if (explicitUserId) {
    const profile = await getProfile(supabase, explicitUserId);
    if (!profile) throw new Error(`RESTORE_LEGACY_ADMIN_USER_ID not found in profiles: ${explicitUserId}`);
    return [profile];
  }

  const targetEmail = (process.env.RESTORE_LEGACY_ADMIN_EMAIL || LEGACY_ADMIN_EMAIL).trim().toLowerCase();
  const candidates = [];

  const { data: profileByEmail, error: profileEmailError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status, is_super_admin, requires_password_change")
    .ilike("email", targetEmail);
  if (profileEmailError) throw profileEmailError;
  candidates.push(...(profileByEmail || []));

  const authUser = await findAuthUserByEmail(supabase, targetEmail);
  if (authUser?.id) {
    const profile = await getProfile(supabase, authUser.id);
    if (profile) candidates.push(profile);
  }

  const { data: chatAdmins, error: chatAdminError } = await supabase
    .from("conversations")
    .select("admin:profiles!admin_id(id, email, full_name, role, status, is_super_admin, requires_password_change)")
    .not("admin_id", "is", null);
  if (chatAdminError && !["42P01", "PGRST205"].includes(chatAdminError.code)) throw chatAdminError;

  for (const row of chatAdmins || []) {
    const admin = Array.isArray(row.admin) ? row.admin[0] : row.admin;
    if (admin?.role === "admin" && !admin.is_super_admin && (admin.email?.toLowerCase() === targetEmail || admin.status === "blocked")) {
      candidates.push(admin);
    }
  }

  return uniqueById(candidates);
}

async function upsertAdminPermissions(supabase, userId) {
  const { error: roleError } = await supabase.from("user_roles").upsert(
    {
      user_id: userId,
      role: "admin",
      is_active: true,
      metadata: { restored_legacy_admin: true },
    },
    { onConflict: "user_id,role" },
  );
  if (roleError) throw roleError;

  const { error: permissionError } = await supabase.from("admin_permissions").upsert(
    ADMIN_MODULES.map((module) => ({
      admin_id: userId,
      module,
      can_view: true,
      can_manage: true,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "admin_id,module" },
  );
  if (permissionError) throw permissionError;
}

async function summarizeChatLinks(supabase, userId) {
  const { count: conversationCount, error: conversationError } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", userId);
  if (conversationError && !["42P01", "PGRST205"].includes(conversationError.code)) throw conversationError;

  const { count: sentMessageCount, error: messageError } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", userId);
  if (messageError && !["42P01", "PGRST205"].includes(messageError.code)) throw messageError;

  return {
    conversationsAsAdmin: conversationCount || 0,
    messagesSentByAdmin: sentMessageCount || 0,
  };
}


async function verifyLogin(url, anonKey, email, password, expectedUserId) {
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Login verification failed: ${error?.message || "No user returned"}`);
  if (data.user.id !== expectedUserId) {
    throw new Error(`Login verification returned unexpected user_id: ${data.user.id}`);
  }

  const { data: profile, error: profileError } = await anon
    .from("profiles")
    .select("role, status, is_super_admin")
    .eq("id", expectedUserId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.role !== "admin" || profile?.status === "blocked" || profile?.is_super_admin) {
    throw new Error("Login verification failed: profile is not an active regular admin");
  }

  await anon.auth.signOut();
}
async function main() {
  loadDotEnv(envPath);

  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const targetEmail = (process.env.RESTORE_LEGACY_ADMIN_EMAIL || LEGACY_ADMIN_EMAIL).trim().toLowerCase();
  const fullName = process.env.RESTORE_LEGACY_ADMIN_NAME?.trim() || "Admin he thong";
  const password = process.env.RESTORE_LEGACY_ADMIN_PASSWORD?.trim();

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const candidates = await findLegacyAdminCandidates(supabase);
  if (candidates.length === 0) {
    throw new Error(`No legacy admin candidate found. Set RESTORE_LEGACY_ADMIN_USER_ID to preserve the exact chat user_id.`);
  }
  if (candidates.length > 1) {
    console.error(JSON.stringify({ candidates }, null, 2));
    throw new Error("Multiple legacy admin candidates found. Set RESTORE_LEGACY_ADMIN_USER_ID before running.");
  }

  const legacyAdmin = candidates[0];
  const authPayload = {
    email: targetEmail,
    email_confirm: true,
    ban_duration: "none",
    user_metadata: {
      full_name: fullName,
      role: "admin",
      requested_role: "admin",
      restored_legacy_admin: true,
    },
  };
  if (password) authPayload.password = password;

  const authResult = await supabase.auth.admin.updateUserById(legacyAdmin.id, authPayload);
  if (authResult.error) throw authResult.error;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      email: targetEmail,
      full_name: fullName,
      role: "admin",
      status: "active",
      is_super_admin: false,
      requires_password_change: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", legacyAdmin.id);
  if (profileError) throw profileError;

  await upsertAdminPermissions(supabase, legacyAdmin.id);
  if (password) {
    await verifyLogin(url, anonKey, targetEmail, password, legacyAdmin.id);
  }

  const chat = await summarizeChatLinks(supabase, legacyAdmin.id);
  const restoredProfile = await getProfile(supabase, legacyAdmin.id);

  console.log(JSON.stringify({
    ok: true,
    userId: legacyAdmin.id,
    email: targetEmail,
    fullName,
    profile: restoredProfile,
    chat,
    passwordUpdated: Boolean(password),
    loginVerified: Boolean(password),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
