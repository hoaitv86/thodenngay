import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const core = read("lib/notifications/core.ts");
const registrationRoute = read("app/api/notifications/registration-email/route.ts");
const accountRoute = read("app/api/notifications/account-email/route.ts");
const registerPage = read("app/register/page.tsx");
const adminWorkersPage = read("app/admin/workers/page.tsx");

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

console.log("account email flows: customer welcome, worker pending, worker approved dedupe OK");

