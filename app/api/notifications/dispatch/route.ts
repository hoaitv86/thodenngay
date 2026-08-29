import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-server";
import { dispatchPendingAccountEmails } from "@/lib/notifications/email";
import { getServiceRoleSupabase } from "@/lib/notifications/core";
import { dispatchPendingPushNotifications } from "@/lib/notifications/push";

export const runtime = "nodejs";

type DispatchBody = { limit?: number; emailLimit?: number; pushLimit?: number };

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

  const fallbackLimit = Math.max(1, Math.min(Number(body.limit) || 50, 200));
  const pushLimit = Math.max(1, Math.min(Number(body.pushLimit) || fallbackLimit, 200));
  const emailLimit = Math.max(1, Math.min(Number(body.emailLimit) || fallbackLimit, 200));

  const [push, email] = await Promise.all([
    dispatchPendingPushNotifications(supabase, pushLimit).catch((error: unknown) => ({
      sent: 0,
      failed: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : "push_dispatch_failed",
    })),
    dispatchPendingAccountEmails(supabase, emailLimit).catch((error: unknown) => ({
      sent: 0,
      failed: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : "email_dispatch_failed",
    })),
  ]);

  return NextResponse.json({ push, email }, { status: push.error ? 500 : 200 });
}
