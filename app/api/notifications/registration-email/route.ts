import { NextResponse } from "next/server";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";
import { buildAccountEmail, enqueueAccountEmail, getServiceRoleSupabase } from "@/lib/notifications/core";

type Body = { template?: "customer_welcome" | "worker_pending" };

export async function POST(request: Request) {
  const authClient = await createServerAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Khong duoc phep truy cap." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.template !== "customer_welcome" && body.template !== "worker_pending") {
    return NextResponse.json({ error: "Template khong hop le." }, { status: 400 });
  }

  const supabase = getServiceRoleSupabase() || authClient;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Khong tim thay tai khoan." }, { status: 404 });

  const email = buildAccountEmail(body.template, profile.full_name);
  await enqueueAccountEmail(supabase, {
    userId: profile.id,
    toEmail: profile.email,
    template: body.template,
    subject: email.subject,
    body: email.body,
    metadata: { source: "registration" },
  });

  return NextResponse.json({ ok: true });
}
