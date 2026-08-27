import type { SupabaseClient } from "@supabase/supabase-js";
import webPush, { type PushSubscription } from "web-push";

export type StoredPushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  subscription: PushSubscription;
  user_agent?: string | null;
};

type DeliveryQueueRow = {
  id: string;
  notification_id: string;
  target_user_id: string;
  title: string;
  body: string;
  target_url?: string | null;
  attempts: number;
  expires_at?: string | null;
};

const pushTtlSeconds = 60 * 60 * 24 * 3;

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "";
}

function getVapidPrivateKey() {
  return process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "";
}

function getVapidSubject() {
  return process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:support@thodenngay.vn";
}

export function hasWebPushConfig() {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}

export function configureWebPush() {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) return false;
  webPush.setVapidDetails(getVapidSubject(), publicKey, privateKey);
  return true;
}

function isGonePushError(error: unknown) {
  const record = error as { statusCode?: unknown; status?: unknown };
  return record.statusCode === 404 || record.statusCode === 410 || record.status === 404 || record.status === 410;
}

function getPushErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "push_delivery_failed";
}

export async function dispatchPendingPushNotifications(supabase: SupabaseClient, limit = 50) {
  if (!configureWebPush()) {
    return { sent: 0, failed: 0, skipped: 0, error: "Missing Web Push VAPID config" };
  }

  try {
    await supabase.rpc("skip_expired_notification_push");
  } catch {
    // The dispatcher still guards expiry row-by-row if the migration function is unavailable.
  }

  const { data: queueRows, error } = await supabase
    .from("notification_delivery_queue")
    .select("id, notification_id, target_user_id, title, body, target_url, attempts, expires_at")
    .eq("channel", "push")
    .eq("status", "pending")
    .lte("not_before", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return { sent: 0, failed: 0, skipped: 0, error: error.message };

  const rows = (queueRows || []) as DeliveryQueueRow[];
  if (rows.length === 0) return { sent: 0, failed: 0, skipped: 0 };

  const userIds = [...new Set(rows.map((row) => row.target_user_id))];
  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("notification_push_subscriptions")
    .select("id, user_id, endpoint, subscription, user_agent")
    .in("user_id", userIds)
    .eq("is_active", true);

  if (subscriptionError) return { sent: 0, failed: rows.length, skipped: 0, error: subscriptionError.message };

  const subscriptionsByUser = new Map<string, StoredPushSubscription[]>();
  ((subscriptions || []) as StoredPushSubscription[]).forEach((subscription) => {
    const current = subscriptionsByUser.get(subscription.user_id) || [];
    current.push(subscription);
    subscriptionsByUser.set(subscription.user_id, current);
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const expired = row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
    if (expired) {
      skipped += 1;
      await supabase.from("notification_delivery_queue").update({ status: "skipped", last_error: "expired_before_delivery", attempts: row.attempts + 1 }).eq("id", row.id);
      continue;
    }

    const targets = subscriptionsByUser.get(row.target_user_id) || [];
    if (targets.length === 0) {
      skipped += 1;
      await supabase.from("notification_delivery_queue").update({ status: "skipped", last_error: "no_active_push_subscription", attempts: row.attempts + 1 }).eq("id", row.id);
      continue;
    }

    const payload = JSON.stringify({
      notificationId: row.notification_id,
      title: row.title,
      body: row.body,
      url: row.target_url || "/",
      expiresAt: row.expires_at || null,
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
    });

    const results = await Promise.allSettled(targets.map((target) => webPush.sendNotification(target.subscription, payload, { TTL: pushTtlSeconds })));
    const successCount = results.filter((result) => result.status === "fulfilled").length;
    const rejectedResults = results
      .map((result, index) => ({ result, target: targets[index] }))
      .filter((item): item is { result: PromiseRejectedResult; target: StoredPushSubscription } => item.result.status === "rejected");

    const inactiveIds = rejectedResults
      .filter((item) => isGonePushError(item.result.reason))
      .map((item) => item.target.id);

    if (inactiveIds.length > 0) {
      await supabase.from("notification_push_subscriptions").update({ is_active: false, last_error: "subscription_gone", updated_at: new Date().toISOString() }).in("id", inactiveIds);
    }

    if (successCount > 0) {
      sent += 1;
      await supabase.from("notification_delivery_queue").update({ status: "sent", sent_at: new Date().toISOString(), attempts: row.attempts + 1, last_error: rejectedResults[0] ? getPushErrorMessage(rejectedResults[0].result.reason) : null }).eq("id", row.id);
    } else {
      failed += 1;
      await supabase.from("notification_delivery_queue").update({ status: "failed", attempts: row.attempts + 1, last_error: rejectedResults[0] ? getPushErrorMessage(rejectedResults[0].result.reason) : "push_delivery_failed" }).eq("id", row.id);
    }
  }

  return { sent, failed, skipped };
}
