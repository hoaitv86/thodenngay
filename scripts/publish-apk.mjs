import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const sourceApkPath = path.join(rootDir, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
const metadataPath = path.join(rootDir, "android", "app", "build", "outputs", "apk", "release", "output-metadata.json");
const targetApkPath = path.join(rootDir, "public", "downloads", "thodenngay.apk");

async function assertFileExists(filePath, label) {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error(`${label} is not a file: ${filePath}`);
    return fileStat;
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`${label} does not exist: ${filePath}`);
    }
    throw error;
  }
}

async function readApkMetadata() {
  await assertFileExists(metadataPath, "Release metadata");
  const raw = await readFile(metadataPath, "utf8");
  const metadata = JSON.parse(raw);
  const element = metadata.elements?.find((item) => item?.outputFile === "app-release.apk") || metadata.elements?.[0];
  if (!element) throw new Error(`No APK element found in ${metadataPath}`);
  if (!Number.isInteger(element.versionCode)) throw new Error("APK metadata is missing versionCode.");
  if (typeof element.versionName !== "string" || element.versionName.length === 0) {
    throw new Error("APK metadata is missing versionName.");
  }

  return {
    applicationId: metadata.applicationId || "unknown",
    versionCode: String(element.versionCode),
    versionName: element.versionName,
    variantName: metadata.variantName || "release",
  };
}

async function findAapt() {
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdkRoot) return null;

  try {
    const buildToolsDir = path.join(sdkRoot, "build-tools");
    const versions = await readdir(buildToolsDir, { withFileTypes: true });
    const sortedVersions = versions
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    for (const version of sortedVersions) {
      const candidate = path.join(buildToolsDir, version, process.platform === "win32" ? "aapt.exe" : "aapt");
      try {
        await assertFileExists(candidate, "aapt");
        return candidate;
      } catch {
        // Try the next build-tools version.
      }
    }
  } catch {
    return null;
  }

  return null;
}

function parseBadging(output) {
  const line = output.split(/\r?\n/).find((item) => item.startsWith("package:"));
  if (!line) throw new Error("aapt output did not include a package line.");

  const getValue = (name) => {
    const match = line.match(new RegExp(`${name}='([^']+)'`));
    return match?.[1] || null;
  };

  const applicationId = getValue("name");
  const versionCode = getValue("versionCode");
  const versionName = getValue("versionName");
  if (!applicationId || !versionCode || !versionName) {
    throw new Error(`Could not parse APK package metadata from: ${line}`);
  }

  return { applicationId, versionCode, versionName };
}

async function readApkBadging(filePath) {
  const aapt = await findAapt();
  if (!aapt) {
    throw new Error("Could not find aapt. Set ANDROID_HOME or ANDROID_SDK_ROOT before publishing APK.");
  }

  const result = spawnSync(aapt, ["dump", "badging", filePath], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`aapt failed for ${filePath}: ${result.stderr || result.stdout}`);
  }

  return parseBadging(result.stdout);
}

async function assertApkMagic(filePath) {
  const buffer = await readFile(filePath);
  const magic = buffer.subarray(0, 2).toString("ascii");
  if (magic !== "PK") {
    throw new Error(`File is not an APK/ZIP binary: ${filePath}`);
  }
}

async function sha256(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function formatBytes(bytes) {
  return `${bytes} bytes (${(bytes / 1024 / 1024).toFixed(2)} MB)`;
}

function assertSameVersion(metadata, badging) {
  if (metadata.applicationId !== badging.applicationId) {
    throw new Error(`Application ID mismatch: metadata=${metadata.applicationId}, apk=${badging.applicationId}`);
  }
  if (metadata.versionCode !== badging.versionCode) {
    throw new Error(`Version code mismatch: metadata=${metadata.versionCode}, apk=${badging.versionCode}`);
  }
  if (metadata.versionName !== badging.versionName) {
    throw new Error(`Version name mismatch: metadata=${metadata.versionName}, apk=${badging.versionName}`);
  }
}

async function main() {
  const [sourceStat, metadata] = await Promise.all([
    assertFileExists(sourceApkPath, "Release APK"),
    readApkMetadata(),
  ]);

  await assertApkMagic(sourceApkPath);
  const sourceBadging = await readApkBadging(sourceApkPath);
  assertSameVersion(metadata, sourceBadging);
  const sourceHash = await sha256(sourceApkPath);

  await mkdir(path.dirname(targetApkPath), { recursive: true });
  await copyFile(sourceApkPath, targetApkPath);

  const targetStat = await assertFileExists(targetApkPath, "Published APK");
  await assertApkMagic(targetApkPath);
  const targetBadging = await readApkBadging(targetApkPath);
  assertSameVersion(metadata, targetBadging);
  const targetHash = await sha256(targetApkPath);

  if (sourceHash !== targetHash || sourceStat.size !== targetStat.size) {
    throw new Error("Published APK does not match release APK after copy.");
  }

  console.log("Published APK");
  console.log(`  Source: ${sourceApkPath}`);
  console.log(`  Target: ${targetApkPath}`);
  console.log(`  Application ID: ${targetBadging.applicationId}`);
  console.log(`  Variant: ${metadata.variantName}`);
  console.log(`  Version code: ${targetBadging.versionCode}`);
  console.log(`  Version name: ${targetBadging.versionName}`);
  console.log(`  Size: ${formatBytes(targetStat.size)}`);
  console.log(`  SHA256: ${targetHash}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
