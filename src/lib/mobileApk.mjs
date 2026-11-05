import { readFile, open, realpath } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export const MOBILE_APK_NOT_FOUND = "Chưa có bản APK để tải xuống.";
export function isValidApkFileName(value) {
  return typeof value === "string" && /^[A-Za-z0-9._+-]+\.apk$/.test(value) && basename(value) === value;
}

export function parseApkManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || typeof value.version !== "string" || !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/.test(value.version)
    || !Number.isSafeInteger(value.versionCode) || value.versionCode < 1
    || !isValidApkFileName(value.fileName)
    || !Number.isSafeInteger(value.size) || value.size < 1
    || typeof value.sha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(value.sha256)
    || typeof value.publishedAt !== "string" || !Number.isFinite(Date.parse(value.publishedAt))) {
    throw new Error("Invalid APK manifest");
  }
  const { version, versionCode, fileName, size, sha256, publishedAt } = value;
  return { version, versionCode, fileName, size, sha256, publishedAt };
}

export function mobileApkDirectory() {
  return process.env.MOBILE_APK_DIR || "/opt/thoidai-work/mobile-dist";
}

export async function readApkManifest(directory = mobileApkDirectory()) {
  return parseApkManifest(JSON.parse(await readFile(join(directory, "latest.json"), "utf8")));
}

export async function openApkFile(directory, manifest) {
  const validated = parseApkManifest(manifest);
  const root = await realpath(directory);
  const path = await realpath(join(root, validated.fileName));
  if (dirname(path) !== root) throw new Error("APK outside distribution directory");
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size !== validated.size) throw new Error("APK size mismatch");
    return handle;
  } catch (error) { await handle.close(); throw error; }
}
