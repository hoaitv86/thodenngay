#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const OFFICIAL_SUPER_ADMIN_EMAIL = "superadmin@thodenngay.vn";
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

function normalizePhone(phone = "") {
  return String(phone).replace(/\D/g, "");
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
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

async function upsertRoleAndPermissions(supabase, userId) {
  await supabase.from("user_roles").upsert(
    { user_id: userId, role: "admin", is_active: true },
    { onConflict: "user_id,role" },
  );

  await supabase.from("admin_permissions").upsert(
    ADMIN_MODULES.map((module) => ({
      admin_id: userId,
      module,
      can_view: true,
      can_manage: true,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "admin_id,module" },
  );
}

async function demoteOtherSuperAdmins(supabase, superAdminId) {
  await supabase
    .from("profiles")
    .update({ is_super_admin: false })
    .eq("role", "admin")
    .neq("id", superAdminId);
}

async function disableLegacyAdmin(supabase, superAdminId) {
  const legacyEmails = (process.env.LEGACY_ADMIN_EMAILS || "admin@alotho.local,admin@thodenngay.vn")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const disabled = [];

  for (const legacyEmail of legacyEmails) {
    const legacyAuthUser = await findAuthUserByEmail(supabase, legacyEmail);
    if (!legacyAuthUser || legacyAuthUser.id === superAdminId) continue;

    await supabase.auth.admin.updateUserById(legacyAuthUser.id, {
      ban_duration: "876000h",
      user_metadata: {
        ...(legacyAuthUser.user_metadata || {}),
        disabled_reason: "Migrated to official Super Admin",
      },
    });

    await supabase
      .from("profiles")
      .update({ status: "blocked", is_super_admin: false, requires_password_change: false })
      .eq("id", legacyAuthUser.id);

    await supabase
      .from("user_roles")
      .update({ is_active: false })
      .eq("user_id", legacyAuthUser.id)
      .eq("role", "admin");

    disabled.push(legacyEmail);
  }

  return { disabled: disabled.length > 0, emails: disabled };
}
async function verifyLogin(url, anonKey, email, password) {
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Login verification failed: ${error?.message || "No user returned"}`);

  const { data: profile, error: profileError } = await anon
    .from("profiles")
    .select("role, status, is_super_admin, requires_password_change")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.role !== "admin" || profile?.status === "blocked" || profile?.is_super_admin !== true) {
    throw new Error("Login verification failed: profile is not an active Super Admin");
  }
  if (profile?.requires_password_change !== true) {
    throw new Error("Login verification failed: first password change is not required");
  }

  await anon.auth.signOut();
  return data.user.id;
}

async function main() {
  loadDotEnv(envPath);

  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const password = required("INITIAL_SUPER_ADMIN_PASSWORD");
  const fullName = process.env.INITIAL_SUPER_ADMIN_NAME?.trim() || "Super Admin";
  const configuredEmail = process.env.INITIAL_SUPER_ADMIN_EMAIL?.trim().toLowerCase() || OFFICIAL_SUPER_ADMIN_EMAIL;
  const configuredPhone = normalizePhone(process.env.INITIAL_SUPER_ADMIN_PHONE || "");

  if (configuredEmail !== OFFICIAL_SUPER_ADMIN_EMAIL) {
    throw new Error(`INITIAL_SUPER_ADMIN_EMAIL must be ${OFFICIAL_SUPER_ADMIN_EMAIL}`);
  }
  if (password.length < 8) throw new Error("INITIAL_SUPER_ADMIN_PASSWORD must be at least 8 characters");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existing = await findAuthUserByEmail(supabase, OFFICIAL_SUPER_ADMIN_EMAIL);
  const authPayload = {
    email: OFFICIAL_SUPER_ADMIN_EMAIL,
    password,
    email_confirm: true,
    phone: configuredPhone || undefined,
    user_metadata: {
      full_name: fullName,
      role: "admin",
      requested_role: "admin",
      login_phone: configuredPhone || null,
      requires_password_change: true,
    },
  };

  const authResult = existing
    ? await supabase.auth.admin.updateUserById(existing.id, authPayload)
    : await supabase.auth.admin.createUser(authPayload);

  if (authResult.error) throw authResult.error;
  const authUser = authResult.data.user;
  if (!authUser) throw new Error("Supabase did not return an auth user");

  await supabase.from("profiles").upsert({
    id: authUser.id,
    email: OFFICIAL_SUPER_ADMIN_EMAIL,
    phone: configuredPhone || null,
    full_name: fullName,
    role: "admin",
    status: "active",
    is_super_admin: true,
    requires_password_change: true,
  });

  await upsertRoleAndPermissions(supabase, authUser.id);
  await verifyLogin(url, anonKey, OFFICIAL_SUPER_ADMIN_EMAIL, password);
  await demoteOtherSuperAdmins(supabase, authUser.id);
  const legacyResult = await disableLegacyAdmin(supabase, authUser.id);

  console.log(JSON.stringify({
    ok: true,
    userId: authUser.id,
    email: OFFICIAL_SUPER_ADMIN_EMAIL,
    phone: configuredPhone || null,
    created: !existing,
    legacyAdmin: legacyResult,
    loginVerified: true,
    requiresPasswordChange: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
