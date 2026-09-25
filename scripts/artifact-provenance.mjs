const REQUIRED = ["local_head", "remote_head", "artifact_source_commit", "metadata_commit", "current_production_parent", "integration_baseline", "contract_suite"];

export function parseProvenance(text) {
  return Object.fromEntries(String(text).split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

export function validateProvenance(values) {
  const missing = REQUIRED.filter((key) => !values?.[key]);
  const mismatches = [];
  if (values?.local_head && values?.remote_head && values.local_head !== values.remote_head) mismatches.push("local_head!=remote_head");
  if (values?.local_head && values?.artifact_source_commit && values.local_head !== values.artifact_source_commit) mismatches.push("local_head!=artifact_source_commit");
  if (values?.artifact_source_commit && values?.metadata_commit && values.artifact_source_commit !== values.metadata_commit) mismatches.push("artifact_source_commit!=metadata_commit");
  return { ok: missing.length === 0 && mismatches.length === 0, missing, mismatches };
}
