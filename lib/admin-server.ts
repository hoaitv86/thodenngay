import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { type AdminAction, type AdminModule, DEFAULT_ADMIN_PERMISSIONS } from "@/lib/admin-roles";

export type AdminProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status?: string | null;
  is_super_admin?: boolean | null;
};

export async function createCookieSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Route handlers can ignore cookie write races.
          }
        },
      },
    },
  );
}

export function createServiceSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getCurrentAdminProfile(supabase?: Awaited<ReturnType<typeof createCookieSupabaseClient>>) {
  const client = supabase || await createCookieSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await client
    .from("profiles")
    .select("id, email, full_name, role, status, is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: (profile || null) as AdminProfile | null };
}

export async function requireAdmin() {
  const supabase = await createCookieSupabaseClient();
  const { user, profile } = await getCurrentAdminProfile(supabase);

  if (!user || !profile) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 }),
    };
  }

  if (profile.role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Không có quyền quản trị." }, { status: 403 }),
    };
  }

  if (profile.status === "blocked") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Tài khoản admin đang bị khóa." }, { status: 403 }),
    };
  }

  return { ok: true as const, supabase, user, profile };
}

export async function getAdminPermissions(serviceClient: SupabaseClient, userId: string, isSuperAdmin?: boolean | null) {
  if (isSuperAdmin) return DEFAULT_ADMIN_PERMISSIONS;

  const { data, error } = await serviceClient
    .from("admin_permissions")
    .select("module, can_view, can_manage")
    .eq("admin_id", userId);

  if (error || !data || data.length === 0) return DEFAULT_ADMIN_PERMISSIONS;

  return DEFAULT_ADMIN_PERMISSIONS.map((fallback) => {
    const saved = data.find((item) => item.module === fallback.module);
    return saved ? { ...fallback, ...saved } : fallback;
  });
}

export async function requireAdminPermission(module: AdminModule, action: AdminAction = "view") {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (auth.profile.is_super_admin) return auth;

  try {
    const service = createServiceSupabaseClient();
    const permissions = await getAdminPermissions(service, auth.profile.id, false);
    const permission = permissions.find((item) => item.module === module);
    const allowed = action === "manage" ? permission?.can_manage : permission?.can_view || permission?.can_manage;

    if (!allowed) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Tài khoản admin chưa được cấp quyền cho module này." }, { status: 403 }),
      };
    }
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Không thể kiểm tra phân quyền admin." }, { status: 500 }),
    };
  }

  return auth;
}

export async function syncAdminRole(serviceClient: SupabaseClient, userId: string, grantedBy?: string) {
  await serviceClient
    .from("user_roles")
    .upsert(
      {
        user_id: userId,
        role: "admin",
        is_active: true,
        granted_by: grantedBy || null,
      },
      { onConflict: "user_id,role" },
    );
}

export async function syncAdminPermissions(
  serviceClient: SupabaseClient,
  userId: string,
  permissions = DEFAULT_ADMIN_PERMISSIONS,
  grantedBy?: string,
) {
  await serviceClient.from("admin_permissions").upsert(
    permissions.map((permission) => ({
      admin_id: userId,
      module: permission.module,
      can_view: permission.can_view || permission.can_manage,
      can_manage: permission.can_manage,
      granted_by: grantedBy || null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "admin_id,module" },
  );
}
