const SHA = /^[0-9a-f]{40}$/i;

export function parseReleaseLineage(text) {
  return Object.fromEntries(String(text).split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line.indexOf("=");
    return index < 0 ? [line, ""] : [line.slice(0, index), line.slice(index + 1)];
  }));
}

export function assertReleaseLineage({
  candidateCommit,
  currentProductionCommit,
  integrationCommit,
  candidateBranch,
  candidateDescendsFromProduction,
  integrationContainsProduction,
  directVpsApproved = false,
  directVpsBaseCommit = "",
  changedFiles = [],
  directVpsAllowedFiles = [],
) {
  for (const [name, value] of Object.entries({ candidateCommit, currentProductionCommit, integrationCommit })) {
    if (!SHA.test(String(value || ""))) throw new Error(`${name} must be a 40-character commit SHA`);
  }
  if (!candidateDescendsFromProduction) {
    throw new Error(`candidate must descend from current production ${currentProductionCommit}`);
  }
  if (!integrationContainsProduction) {
    throw new Error(`integration/production must contain current production ${currentProductionCommit}`);
  }
  if (candidateBranch !== "integration/production") {
    const isDirectVpsBranch = /^codex\/direct-vps-[A-Za-z0-9._-]+$/.test(candidateBranch || "");
    if (!isDirectVpsBranch || !directVpsApproved) {
      throw new Error(`candidate must be built from integration/production, got ${candidateBranch || "unknown"}`);
    }
    if (currentProductionCommit !== directVpsBaseCommit) {
      throw new Error(`direct VPS base mismatch: expected ${currentProductionCommit}, got ${directVpsBaseCommit || "missing"}`);
    }
    const allowed = new Set(directVpsAllowedFiles);
    const unexpectedFiles = changedFiles.filter((file) => !allowed.has(file));
    if (unexpectedFiles.length > 0) {
      throw new Error(`direct VPS change outside allowlist: ${unexpectedFiles.join(", ")}`);
    }
  }
  return true;
}
