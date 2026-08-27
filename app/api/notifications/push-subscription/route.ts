import { NextResponse } from "next/server";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";
import { getServiceRoleSupabase } from "@/lib/notifications/core";
import { getVapidPublicKey, hasWebPushConfig } from "@/lib/notifications/push";

type SubscribeBody = {
  subscription?: PushSubscriptionJSON;
  userAgent?: string | null;
};

export async function GET() {
  return NextResponse.json({ publicKey: getVapidPublicKey(), configured: hasWebPushConfig() });
}

export async function POST(request: Request) {
  const authClient = await createServerAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Khong duoc phep truy cap." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as SubscribeBody;
  const endpoint = body.subscription?.endpoint;
  if (!endpoint || !body.subscription?.keys?.p256dh || !body.subscription?.keys?.auth) {
    return NextResponse.json({ error: "Thieu push subscription." }, { status: 400 });
  }

  const supabase = getServiceRoleSupabase();
  if (!supabase) return NextResponse.json({ error: "Missing service role" }, { status: 500 });

  const { error } = await supabase.from("notification_push_subscriptions").upsert({
    user_id: user.id,
    endpoint,
    subscription: body.subscription,
    user_agent: body.userAgent || request.headers.get("user-agent") || null,
    is_active: true,
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authClient = await createServerAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Khong duoc phep truy cap." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (!body.endpoint) return NextResponse.json({ ok: true });

  const supabase = getServiceRoleSupabase();
  if (!supabase) return NextResponse.json({ error: "Missing service role" }, { status: 500 });

  const { error } = await supabase
    .from("notification_push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("endpoint", body.endpoint);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
