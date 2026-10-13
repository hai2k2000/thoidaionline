import { createHash } from "node:crypto";
import { link, lstat, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const APPROVAL_SCOPE = "rbac-v2-authenticated-smoke-waiver";
export const DEFAULT_CONSUMED_REGISTRY = "/var/lib/thoidai-work/deploy-evidence/.rbac-v2-exceptions-consumed";
export const MAX_APPROVAL_LIFETIME_MS = 60 * 60 * 1000;
export const READINESS_PRODUCER = "thoidai-rbac-v2-safe-rollout-v1";
export const READINESS_SCOPE = "rbac-v2-production-readiness";
export const REQUIRED_READINESS_CHECKS = ["backup_integrity", "disposable_restore", "migration_rbac_v2", "schema_rpc", "grants_parity", "last_permission_manager"];

const isSafeField = (value) => typeof value === "string" && /^[A-Za-z0-9._:@/-]{1,200}$/.test(value);
const isSafeExceptionId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) && !value.includes("..") && !value.includes("/") && !value.includes("\\");

export function validateRegistryStat(stat, { enforcePrivate = false, enforceOwner = false } = {}) {
  const errors = [];
  if (!stat?.isDirectory?.()) errors.push("registry must be a directory");
  if ((enforcePrivate || enforceOwner) && (stat?.mode ?? 0) & 0o077) errors.push("registry must not be group/world accessible");
  if (enforceOwner && stat?.uid !== 0) errors.push("registry must be owned by root");
  return { ok: errors.length === 0, errors };
}

export function validateApproval(approval, { expectedCommit, now = new Date() } = {}) {
  const errors = [];
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) errors.push("approval must be an object");
  if (approval?.schema_version !== 1) errors.push("unsupported approval schema");
  if (!/^[a-f0-9]{40}$/.test(expectedCommit || "")) errors.push("expected commit is invalid");
  if (approval?.approved_commit !== expectedCommit) errors.push("approved commit does not match artifact");
  if (approval?.approval_scope !== APPROVAL_SCOPE) errors.push("approval scope is invalid");
  if (approval?.owner_approved !== true) errors.push("owner approval is required");
  if (!isSafeExceptionId(approval?.exception_id)) errors.push("exception_id is not a safe single-component identifier");
  for (const field of ["exception_id", "approved_by", "approval_reference", "evidence_reference"]) {
    if (!isSafeField(approval?.[field])) errors.push(`${field} is required and must be a safe identifier`);
  }
  for (const field of ["approved_at", "expires_at"]) {
    if (!Number.isFinite(Date.parse(approval?.[field]))) errors.push(`${field} is invalid`);
  }
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const expiresMs = Date.parse(approval?.expires_at);
  const approvedMs = Date.parse(approval?.approved_at);
  if (Number.isFinite(approvedMs) && approvedMs > nowMs) errors.push("approval is from the future");
  if (Number.isFinite(expiresMs) && expiresMs <= nowMs) errors.push("approval has expired");
  if (Number.isFinite(approvedMs) && Number.isFinite(expiresMs) && expiresMs <= approvedMs) errors.push("approval expiry must follow approval time");
  if (Number.isFinite(approvedMs) && Number.isFinite(expiresMs) && expiresMs - approvedMs > MAX_APPROVAL_LIFETIME_MS) errors.push("approval lifetime exceeds one hour");
  if (Object.hasOwn(approval || {}, "used_at")) errors.push("approval was already used");
  return { ok: errors.length === 0, errors };
}

export async function verifyReadinessEvidence(path, { expectedCommit, now = new Date(), enforcePrivate = false, enforceOwner = false } = {}) {
  const stat = await lstat(path).catch(() => { throw new Error("RBAC readiness evidence is missing"); });
  if (!stat.isFile() || (enforcePrivate && (stat.mode & 0o077) !== 0) || (enforceOwner && stat.uid !== 0)) throw new Error("RBAC readiness evidence must be a private root-owned file");
  let readiness;
  try { readiness = JSON.parse(await readFile(path, "utf8")); } catch { throw new Error("RBAC readiness evidence is not valid JSON"); }
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (readiness.schema_version !== 1 || readiness.evidence_scope !== READINESS_SCOPE || readiness.produced_by !== READINESS_PRODUCER) throw new Error("RBAC readiness evidence producer or scope is invalid");
  if (readiness.canonical_commit !== expectedCommit) throw new Error("RBAC readiness evidence commit does not match artifact");
  const verifiedMs = Date.parse(readiness.verified_at);
  const expiresMs = Date.parse(readiness.expires_at);
  if (!Number.isFinite(verifiedMs) || !Number.isFinite(expiresMs) || verifiedMs > nowMs || expiresMs <= nowMs || nowMs - verifiedMs > 30 * 60 * 1000) throw new Error("RBAC readiness evidence is stale or expired");
  const baseDir = dirname(resolve(path));
  for (const name of REQUIRED_READINESS_CHECKS) {
    const check = readiness.checks?.[name];
    if (!check || check.status !== "PASS" || typeof check.evidence_path !== "string" || !/^[A-Za-z0-9._-]+$/.test(check.evidence_path)) throw new Error(`RBAC readiness check is missing: ${name}`);
    const evidencePath = resolve(baseDir, check.evidence_path);
    if (dirname(evidencePath) !== baseDir) throw new Error(`RBAC readiness evidence path escapes manifest: ${name}`);
    const evidenceStat = await lstat(evidencePath).catch(() => null);
    if (!evidenceStat?.isFile() || (enforcePrivate && (evidenceStat.mode & 0o077) !== 0) || (enforceOwner && evidenceStat.uid !== 0)) throw new Error(`RBAC readiness proof is not private: ${name}`);
    const digest = createHash("sha256").update(await readFile(evidencePath)).digest("hex");
    if (digest !== check.sha256) throw new Error(`RBAC readiness proof checksum mismatch: ${name}`);
  }
  return { ok: true };
}

async function readApprovalFile(path, { enforcePrivate = false, enforceOwner = false } = {}) {
  let stat;
  try { stat = await lstat(path); } catch (error) {
    if (error?.code === "ENOENT") throw new Error("approval was already consumed");
    throw error;
  }
  if (!stat.isFile() || (enforcePrivate && (stat.mode & 0o077) !== 0) || (enforceOwner && stat.uid !== 0)) {
    throw new Error("approval file must be a private regular file owned by root");
  }
  let approval;
  try { approval = JSON.parse(await readFile(path, "utf8")); } catch { throw new Error("approval file is not valid JSON"); }
  return approval;
}

export async function consumeApproval(path, { expectedCommit, evidencePath, registryDir = DEFAULT_CONSUMED_REGISTRY, now = new Date(), enforcePrivate = false, enforceOwner = false } = {}) {
  const approval = await readApprovalFile(path, { enforcePrivate, enforceOwner });
  const validation = validateApproval(approval, { expectedCommit, now });
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  const usedPath = `${path}.used-${approval.exception_id}-${Date.parse(approval.expires_at)}`;
  await link(path, usedPath).catch((error) => {
    if (error?.code === "ENOENT" || error?.code === "EEXIST") throw new Error("approval was already consumed");
    throw error;
  });
  const registryPath = `${registryDir}/${approval.exception_id}`;
  await mkdir(dirname(registryPath), { recursive: true, mode: 0o700 });
  const registryStat = await lstat(dirname(registryPath));
  const registryValidation = validateRegistryStat(registryStat, { enforcePrivate, enforceOwner });
  if (!registryValidation.ok) {
    await unlink(usedPath).catch(() => {});
    throw new Error(registryValidation.errors.join("; "));
  }
  await writeFile(registryPath, `approved_commit=${expectedCommit}\nconsumed_at=${new Date(now).toISOString()}\n`, { flag: "wx", mode: 0o600 }).catch((error) => {
    if (error?.code === "EEXIST") {
      return unlink(usedPath).then(() => { throw new Error("approval was already consumed"); });
    }
    throw error;
  });
  await unlink(path).catch(() => {
    throw new Error("approval consumption did not complete");
  });
  if (evidencePath) {
    await mkdir(dirname(evidencePath), { recursive: true, mode: 0o700 });
    await writeFile(evidencePath, [
      "AUTHENTICATED_SMOKE=WAIVED",
      `approval_scope=${APPROVAL_SCOPE}`,
      `approved_commit=${expectedCommit}`,
      `approval_id=${approval.exception_id}`,
      `consumed_at=${new Date(now).toISOString()}`,
      `expires_at=${approval.expires_at}`,
      "approval_state=CONSUMED",
    ].join("\n") + "\n", { mode: 0o600 });
  }
  return { ok: true, approvalId: approval.exception_id, usedPath };
}

if (process.argv[1]?.endsWith("controlled-deploy-exception.mjs")) {
  const [path, expectedCommit, evidencePath, readinessPath] = process.argv.slice(2);
  if (!path || !expectedCommit || !readinessPath) throw new Error("usage: controlled-deploy-exception.mjs <approval.json> <commit> <evidence> <readiness>");
  await verifyReadinessEvidence(readinessPath, { expectedCommit, enforcePrivate: true, enforceOwner: true });
  const result = await consumeApproval(path, { expectedCommit, evidencePath, enforcePrivate: true, enforceOwner: true });
  console.log(`controlled-deploy-exception: PASS (${result.approvalId})`);
}
