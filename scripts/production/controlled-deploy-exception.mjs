import { link, lstat, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const APPROVAL_SCOPE = "rbac-v2-authenticated-smoke-waiver";
export const DEFAULT_CONSUMED_REGISTRY = "/var/lib/thoidai-work/deploy-evidence/.rbac-v2-exceptions-consumed";

const isSafeField = (value) => typeof value === "string" && /^[A-Za-z0-9._:@/-]{1,200}$/.test(value);

export function validateApproval(approval, { expectedCommit, now = new Date() } = {}) {
  const errors = [];
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) errors.push("approval must be an object");
  if (approval?.schema_version !== 1) errors.push("unsupported approval schema");
  if (!/^[a-f0-9]{40}$/.test(expectedCommit || "")) errors.push("expected commit is invalid");
  if (approval?.approved_commit !== expectedCommit) errors.push("approved commit does not match artifact");
  if (approval?.approval_scope !== APPROVAL_SCOPE) errors.push("approval scope is invalid");
  if (approval?.owner_approved !== true) errors.push("owner approval is required");
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
  if (Object.hasOwn(approval || {}, "used_at")) errors.push("approval was already used");
  return { ok: errors.length === 0, errors };
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
  const [path, expectedCommit, evidencePath] = process.argv.slice(2);
  if (!path || !expectedCommit) throw new Error("usage: controlled-deploy-exception.mjs <approval.json> <commit> [evidence]");
  const result = await consumeApproval(path, { expectedCommit, evidencePath, enforcePrivate: true, enforceOwner: true });
  console.log(`controlled-deploy-exception: PASS (${result.approvalId})`);
}
