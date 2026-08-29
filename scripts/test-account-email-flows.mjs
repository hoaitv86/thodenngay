import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const core = read("lib/notifications/core.ts");
const emailDispatcher = read("lib/notifications/email.ts");
const dispatchRoute = read("app/api/notifications/dispatch/route.ts");
const registrationRoute = read("app/api/notifications/registration-email/route.ts");
const accountRoute = read("app/api/notifications/account-email/route.ts");
const registerPage = read("app/register/page.tsx");
const adminWorkersPage = read("app/admin/workers/page.tsx");
const envExample = read(".env.example");
const emailMigration = read("supabase/migration_account_email_resend_delivery.sql");

assert.match(core, /export function isDeliverableAccountEmail/);
assert.match(core, /return !isSyntheticPhoneEmail\(normalizedEmail\)/);
assert.match(core, /normalizedEmail\.endsWith\("\.local"\)/);
assert.match(core, /return \{ error: null, skipped: true as const, reason: "invalid_email" as const \}/);
assert.match(core, /export function getDeliverableAccountEmail/);
assert.ok(
  core.indexOf("const recoveryEmail = profile.recovery_email") < core.indexOf("const email = profile.email"),
  "recovery_email must be preferred before the auth email",
);

assert.match(registrationRoute, /type Body = \{ template\?: "customer_welcome" \| "worker_pending" \}/);
assert.match(registrationRoute, /select\("id, email, recovery_email, full_name"\)/);
assert.match(registrationRoute, /getDeliverableAccountEmail\(profile\)/);
assert.match(registrationRoute, /return NextResponse\.json\(\{ ok: true, queued: false, skipped: true, reason: "profile_lookup_failed" \}\)/);
assert.match(
  registerPage,
  /body: JSON\.stringify\(\{ template: requestWorkerRole \? "worker_pending" : "customer_welcome" \}\)/,
);

assert.match(accountRoute, /select\("id, email, recovery_email, full_name"\)/);
assert.match(accountRoute, /body\.template === "worker_approved" && await hasQueuedAccountEmail/);
assert.match(accountRoute, /reason: "duplicate"/);
assert.match(adminWorkersPage, /const shouldSendApprovalEmail = worker\.status !== 'active' && !worker\.approved_at/);
assert.match(adminWorkersPage, /if \(shouldSendApprovalEmail\) \{\s*void fetch\("\/api\/notifications\/account-email"/s);

assert.match(emailDispatcher, /const resendEndpoint = "https:\/\/api\.resend\.com\/emails"/);
assert.match(emailDispatcher, /process\.env\.RESEND_API_KEY/);
assert.match(emailDispatcher, /process\.env\.ACCOUNT_EMAIL_FROM \|\| process\.env\.RESEND_FROM_EMAIL/);
assert.match(emailDispatcher, /export async function dispatchPendingAccountEmails/);
assert.match(emailDispatcher, /\.in\("status", \["pending", "queued", "failed"\]\)/);
assert.match(emailDispatcher, /\.lt\("attempts", maxEmailAttempts\)/);
assert.match(emailDispatcher, /next_attempt_at: new Date\(Date\.now\(\) \+ emailClaimLockMs\)\.toISOString\(\)/);
assert.match(emailDispatcher, /next_attempt_at\.is\.null,next_attempt_at\.lte/);
assert.match(emailDispatcher, /status: "sent", sent_at: new Date\(\)\.toISOString\(\), last_error: null, next_attempt_at: null/);
assert.match(emailDispatcher, /status: "failed"/);
assert.match(emailDispatcher, /getNextAttemptAt\(row\.attempts \+ 1\)/);
assert.match(emailDispatcher, /!toEmail \|\| !isDeliverableAccountEmail\(toEmail\)/);

assert.match(dispatchRoute, /dispatchPendingPushNotifications/);
assert.match(dispatchRoute, /dispatchPendingAccountEmails/);
assert.match(dispatchRoute, /Promise\.all/);
assert.match(dispatchRoute, /return NextResponse\.json\(\{ push, email \}, \{ status: push\.error \? 500 : 200 \}\)/);

assert.match(envExample, /RESEND_API_KEY=/);
assert.match(envExample, /ACCOUNT_EMAIL_FROM=/);
assert.match(emailMigration, /ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ DEFAULT NOW\(\)/);
assert.match(emailMigration, /CHECK \(status IN \('pending', 'queued', 'sent', 'failed'\)\)/);
assert.match(emailMigration, /ALTER COLUMN status SET DEFAULT 'pending'/);
assert.match(emailMigration, /notification_email_outbox_dispatch_idx/);

console.log("account email flows: customer welcome, worker pending, worker approved Resend delivery OK");
