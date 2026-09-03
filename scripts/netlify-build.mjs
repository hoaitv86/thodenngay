import { existsSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";

const proxy = "proxy.ts";
const backup = "proxy.ts.netlify-disabled";

let renamed = false;

try {
  if (existsSync(proxy)) {
    renameSync(proxy, backup);
    renamed = true;
    console.log("[Netlify build] Temporarily disabled proxy.ts");
  }

  const result = spawnSync("npm", ["run", "build"], {
    stdio: "inherit",
    shell: true,
  });

  process.exitCode = result.status ?? 1;
} finally {
  if (renamed && existsSync(backup)) {
    renameSync(backup, proxy);
    console.log("[Netlify build] Restored proxy.ts");
  }
}