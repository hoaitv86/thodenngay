import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const mainActivity = readFileSync(join(root, "android/app/src/main/java/vn/thodenngay/app/MainActivity.java"), "utf8");
const offlineRuntime = readFileSync(join(root, "app/components/OfflineRuntime.tsx"), "utf8");

assert.match(
  mainActivity,
  /scheduleSafeDeployRefresh\(nextVersion,\s*0L\)/,
  "Native deploy version changes must go through the safe refresh scheduler."
);
assert.doesNotMatch(
  mainActivity,
  /putString\(KEY_WEB_DEPLOY_VERSION,\s*nextVersion\)\.apply\(\);\s*if\s*\(currentVersion != null && !nextVersion\.equals\(currentVersion\)\)\s*\{\s*mainHandler\.post\(\(\) -> reloadFreshAfterCacheInvalidation\("deploy-version-change"\)\)/s,
  "Native must not persist the new deploy version and immediately reload before readiness is verified."
);
assert.match(
  mainActivity,
  /isDeployVersionReady\(\)[\s\S]*extractNextStaticAssets\(html\)[\s\S]*isAssetReachable\(assetUrl\)/,
  "Native safe refresh must verify the shell and its Next static assets before reloading."
);
assert.match(
  mainActivity,
  /String baseUrl = getFallbackUrl\(currentUrl != null \? currentUrl : lastMainFrameStartedUrl\)/,
  "Native refresh must preserve the last valid app route instead of forcing the Android login URL."
);
assert.match(
  mainActivity,
  /isNativeRefreshUrl\(failedUrl\) && loadCachedHtmlSnapshot\(failedUrl\)/,
  "Native refresh failures must fall back to the last cached shell."
);

assert.match(
  offlineRuntime,
  /async function verifyDeployReady\(nextVersion: string\)/,
  "Web runtime must have a deploy readiness probe."
);
assert.match(
  offlineRuntime,
  /const readiness = await verifyDeployReady\(nextVersion\)/,
  "Web runtime must verify deploy readiness before refreshing cache and reloading."
);
assert.match(
  offlineRuntime,
  /writeLocalValue\(DEPLOY_VERSION_STORAGE_KEY,\s*nextVersion\);\s*console\.info\("\[TDN-OFFLINE\]",\s*"web deploy update verified"/,
  "Web runtime must only persist a new deploy version after verification succeeds."
);
assert.match(
  offlineRuntime,
  /hasPotentialUnsavedFormData\(\)[\s\S]*web deploy refresh deferred/,
  "Web runtime must defer deploy refresh while a form may contain unsaved input."
);

console.log("deploy refresh safety checks passed");
