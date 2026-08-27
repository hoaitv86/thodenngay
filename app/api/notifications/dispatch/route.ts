import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-server";
import { getServiceRoleSupabase } from "@/lib/notifications/core";
import { dispatchPendingPushNotifications } from "@/lib/notifications/push";

export const runtime = "nodejs";

type DispatchBody = { limit?: number };

function hasDispatchSecret(request: Request) {
  const secret = process.env.NOTIFICATION_DISPATCH_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as DispatchBody;
  const hasSecret = hasDispatchSecret(request);
  if (!hasSecret) {
    const adminCheck = await requireAdminPermission("analytics", "manage");
    if (!adminCheck.ok) return adminCheck.response;
  }

  const supabase = getServiceRoleSupabase();
  if (!supabase) return NextResponse.json({ error: "Missing service role" }, { status: 500 });

  const limit = Math.max(1, Math.min(Number(body.limit) || 50, 200));
  const result = await dispatchPendingPushNotifications(supabase, limit);
  return NextResponse.json(result, { status: result.error ? 500 : 200 });
}
