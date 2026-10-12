import { createClient } from "@/lib/supabase/server";
import { normalizeHelpArticle, type HelpArticle, type HelpAudience, type HelpCategory } from "@/lib/help";

type ProfileRole = "customer" | "worker" | "admin";
type UserRoleRow = { role?: string | null; is_active?: boolean | null };
type MembershipRow = { member_role?: string | null; status?: string | null };

export type HelpViewer = {
  userId: string | null;
  displayName: string;
  audiences: HelpAudience[];
  isAdmin: boolean;
};

const articleSelect =
  "id,category_id,slug,title,description,content_html,cover_image_url,image_urls,video_url,sort_order,status,is_featured,audiences,help_context,created_at,updated_at,published_at,category:help_categories(id,slug,title,description,icon,sort_order,is_active)";

export async function getHelpViewer(): Promise<HelpViewer> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      displayName: "Khách vãng lai",
      audiences: ["PUBLIC"],
      isAdmin: false,
    };
  }

  const [{ data: profile }, { data: roles }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role, is_active").eq("user_id", user.id),
    supabase.from("worker_unit_members").select("member_role, status").eq("user_id", user.id).eq("status", "active"),
  ]);

  return {
    userId: user.id,
    displayName: String(profile?.full_name || user.email || "Người dùng"),
    audiences: resolveHelpAudiences({
      profileRole: profile?.role as ProfileRole | null | undefined,
      roles: (roles || []) as UserRoleRow[],
      memberships: (memberships || []) as MembershipRow[],
    }),
    isAdmin: profile?.role === "admin" || Boolean((roles || []).some((item) => item.role === "admin" && item.is_active !== false)),
  };
}

export function resolveHelpAudiences(params: {
  profileRole?: string | null;
  roles?: UserRoleRow[];
  memberships?: MembershipRow[];
}): HelpAudience[] {
  const audiences = new Set<HelpAudience>(["PUBLIC", "CUSTOMER"]);
  const activeRoles = new Set((params.roles || []).filter((item) => item.is_active !== false).map((item) => item.role));
  const memberRoles = new Set((params.memberships || []).filter((item) => item.status !== "suspended").map((item) => item.member_role));

  if (params.profileRole === "worker" || activeRoles.has("worker") || activeRoles.has("lead_worker") || activeRoles.has("assistant_worker") || memberRoles.size > 0) {
    audiences.add("WORKER");
  }

  if (activeRoles.has("unit_owner") || memberRoles.has("manager")) {
    audiences.add("WORKER");
    audiences.add("MANAGER");
  }

  if (memberRoles.has("owner")) {
    audiences.add("WORKER");
    audiences.add("MANAGER");
    audiences.add("OWNER");
  }

  if (params.profileRole === "admin" || activeRoles.has("admin")) {
    helpAdminAudiences.forEach((item) => audiences.add(item));
  }

  return [...audiences];
}

const helpAdminAudiences: HelpAudience[] = ["PUBLIC", "CUSTOMER", "WORKER", "MANAGER", "OWNER", "ADMIN"];

export async function listVisibleHelpContent(query?: string | null) {
  const supabase = await createClient();
  const normalizedQuery = query?.trim();
  let articleQuery = supabase
    .from("help_articles")
    .select(articleSelect)
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false });

  if (normalizedQuery) {
    articleQuery = articleQuery.or(`title.ilike.%${normalizedQuery}%,description.ilike.%${normalizedQuery}%,content_html.ilike.%${normalizedQuery}%`);
  }

  const [{ data: categories }, { data: articles, error }] = await Promise.all([
    supabase.from("help_categories").select("id,slug,title,description,icon,sort_order,is_active").eq("is_active", true).order("sort_order", { ascending: true }).order("title", { ascending: true }),
    articleQuery,
  ]);

  if (error) {
    console.warn("Could not load help articles:", error.message);
  }

  return {
    categories: (categories || []) as HelpCategory[],
    articles: (articles || []).map(normalizeHelpArticle),
  };
}

export async function getVisibleHelpArticle(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("help_articles")
    .select(articleSelect)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.warn("Could not load help article:", error.message);
  }

  return data ? normalizeHelpArticle(data) : null;
}
