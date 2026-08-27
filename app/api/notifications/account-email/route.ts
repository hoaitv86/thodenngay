import { NextResponse } from "next/server";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";
import { buildAccountEmail, enqueueAccountEmail, getServiceRoleSupabase } from "@/lib/notifications/core";

type Body = {
  template?: "customer_welcome" | "worker_pending" | "worker_approved" | "worker_rejected";
  userId?: string;
  reason?: string | null;
};

export async function POST(request: Request) {
  const authClient = await createServerAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Khong duoc phep truy cap." }, { status: 401 });

  const { data: adminProfile } = await authClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (adminProfile?.role !== "admin") return NextResponse.json({ error: "Chi admin moi duoc gui email trang thai tai khoan." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.template || !body.userId) return NextResponse.json({ error: "Thieu template/userId." }, { status: 400 });

  const supabase = getServiceRoleSupabase() || authClient;
  const { data: targetProfile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", body.userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!targetProfile) return NextResponse.json({ error: "Khong tim thay tai khoan." }, { status: 404 });

  const email = buildAccountEmail(body.template, targetProfile.full_name, body.reason || null);
  await enqueueAccountEmail(supabase, {
    userId: targetProfile.id,
    toEmail: targetProfile.email,
    template: body.template,
    subject: email.subject,
    body: email.body,
    metadata: { source: "admin_account_status", actor_id: user.id, reason: body.reason || null },
  });

  return NextResponse.json({ ok: true });
}
