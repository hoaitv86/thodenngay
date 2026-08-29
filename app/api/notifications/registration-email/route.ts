import { NextResponse } from "next/server";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";
import { buildAccountEmail, enqueueAccountEmail, getDeliverableAccountEmail, getServiceRoleSupabase } from "@/lib/notifications/core";

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
    .select("id, email, recovery_email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("[notifications] registration email profile lookup failed", error.message);
    return NextResponse.json({ ok: true, queued: false, skipped: true, reason: "profile_lookup_failed" });
  }
  if (!profile) return NextResponse.json({ ok: true, queued: false, skipped: true, reason: "profile_not_found" });

  const toEmail = getDeliverableAccountEmail(profile);
  const email = buildAccountEmail(body.template, profile.full_name);
  const queuedEmail = await enqueueAccountEmail(supabase, {
    userId: profile.id,
    toEmail,
    template: body.template,
    subject: email.subject,
    body: email.body,
    metadata: { source: "registration" },
  });

  return NextResponse.json({ ok: true, queued: !queuedEmail.error && !queuedEmail.skipped, skipped: Boolean(queuedEmail.skipped), reason: queuedEmail.reason || null });
}

