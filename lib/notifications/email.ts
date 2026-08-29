import type { SupabaseClient } from "@supabase/supabase-js";
import { isDeliverableAccountEmail } from "@/lib/notifications/core";

type EmailOutboxStatus = "pending" | "queued" | "sent" | "failed";

type EmailOutboxRow = {
  id: string;
  user_id?: string | null;
  to_email?: string | null;
  template: string;
  subject: string;
  body: string;
  status: EmailOutboxStatus;
  attempts: number;
  last_error?: string | null;
  metadata?: Record<string, unknown> | null;
  next_attempt_at?: string | null;
};

type EmailDispatchResult = {
  sent: number;
  failed: number;
  skipped: number;
  error?: string;
};

const resendEndpoint = "https://api.resend.com/emails";
const maxEmailAttempts = 5;
const emailClaimLockMs = 10 * 60 * 1000;

function getResendApiKey() {
  return process.env.RESEND_API_KEY || "";
}

export function getAccountEmailFrom() {
  return process.env.ACCOUNT_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "";
}

export function hasAccountEmailConfig() {
  return Boolean(getResendApiKey() && getAccountEmailFrom());
}

function getEmailErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "email_delivery_failed";
}

function getNextAttemptAt(attempts: number) {
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

async function sendResendEmail(input: { to: string; subject: string; text: string; tags?: Array<{ name: string; value: string }> }) {
  const response = await fetch(resendEndpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getResendApiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: getAccountEmailFrom(),
      to: [input.to],
      subject: input.subject,
      text: input.text,
      tags: input.tags,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(`resend_${response.status}${responseText ? `: ${responseText}` : ""}`);
  }
}

async function claimEmailRow(supabase: SupabaseClient, row: EmailOutboxRow) {
  const { data, error } = await supabase
    .from("notification_email_outbox")
    .update({
      status: "pending",
      attempts: row.attempts + 1,
      last_error: null,
      next_attempt_at: new Date(Date.now() + emailClaimLockMs).toISOString(),
    })
    .eq("id", row.id)
    .eq("attempts", row.attempts)
    .in("status", ["pending", "queued", "failed"])
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export async function dispatchPendingAccountEmails(supabase: SupabaseClient, limit = 50): Promise<EmailDispatchResult> {
  if (!hasAccountEmailConfig()) {
    return { sent: 0, failed: 0, skipped: 0, error: "Missing RESEND_API_KEY or ACCOUNT_EMAIL_FROM/RESEND_FROM_EMAIL" };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("notification_email_outbox")
    .select("id,user_id,to_email,template,subject,body,status,attempts,last_error,metadata,next_attempt_at")
    .in("status", ["pending", "queued", "failed"])
    .lt("attempts", maxEmailAttempts)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return { sent: 0, failed: 0, skipped: 0, error: error.message };

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of (data || []) as EmailOutboxRow[]) {
    const toEmail = row.to_email?.trim().toLowerCase();
    if (!toEmail || !isDeliverableAccountEmail(toEmail)) {
      skipped += 1;
      await supabase
        .from("notification_email_outbox")
        .update({ status: "failed", attempts: row.attempts + 1, last_error: "invalid_email" })
        .eq("id", row.id)
        .eq("attempts", row.attempts);
      continue;
    }

    try {
      const claimed = await claimEmailRow(supabase, row);
      if (!claimed) {
        skipped += 1;
        continue;
      }

      await sendResendEmail({
        to: toEmail,
        subject: row.subject,
        text: row.body,
        tags: [
          { name: "template", value: row.template },
          { name: "outbox_id", value: row.id },
        ],
      });

      sent += 1;
      await supabase
        .from("notification_email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null, next_attempt_at: null })
        .eq("id", row.id);
    } catch (dispatchError) {
      failed += 1;
      await supabase
        .from("notification_email_outbox")
        .update({
          status: "failed",
          last_error: getEmailErrorMessage(dispatchError).slice(0, 1000),
          next_attempt_at: getNextAttemptAt(row.attempts + 1),
        })
        .eq("id", row.id);
    }
  }

  return { sent, failed, skipped };
}
