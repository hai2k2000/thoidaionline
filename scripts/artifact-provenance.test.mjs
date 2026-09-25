import assert from "node:assert/strict";
import test from "node:test";
import { validateProvenance } from "./artifact-provenance.mjs";

const complete = { local_head: "a", remote_head: "a", artifact_source_commit: "a", metadata_commit: "a", current_production_parent: "p", integration_baseline: "i", contract_suite: "pass" };

test("accepts matching artifact provenance", () => assert.equal(validateProvenance(complete).ok, true));
test("rejects missing or mismatched provenance", () => {
  assert.equal(validateProvenance({ ...complete, remote_head: "b" }).ok, false);
  assert.equal(validateProvenance({ ...complete, contract_suite: "" }).ok, false);
  assert.ok(validateProvenance({ ...complete, artifact_source_commit: "b" }).mismatches.includes("artifact_source_commit!=metadata_commit"));
});
