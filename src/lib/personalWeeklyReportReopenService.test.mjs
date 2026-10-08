import test from "node:test";
import assert from "node:assert/strict";
import {
  boundPersonalWeeklyVersions,
  buildPersonalWeeklyReopenRpcArgs,
  normalizePersonalWeeklyReopenReason,
  personalWeeklyReopenEligibility,
} from "./personalWeeklyReport.ts";

test("reopen RPC args contain only actor, report and reason", () => {
  assert.deepEqual(buildPersonalWeeklyReopenRpcArgs("actor-1", "report-1", "fixed reason"), {
    p_actor: "actor-1", p_report_id: "report-1", p_reason: "fixed reason",
  });
});

test("reopen reason trims and rejects empty, short and long values", () => {
  assert.deepEqual(normalizePersonalWeeklyReopenReason("  valid reason  "), { ok: true, value: "valid reason" });
  assert.equal(normalizePersonalWeeklyReopenReason("   ").ok, false);
  assert.equal(normalizePersonalWeeklyReopenReason("no").ok, false);
  assert.equal(normalizePersonalWeeklyReopenReason("x".repeat(501)).ok, false);
});

test("version history is newest-first and bounded", () => {
  const versions = boundPersonalWeeklyVersions([{ version_no: 1 }, { version_no: 4 }, { version_no: 2 }, { version_no: 3 }], 3);
  assert.deepEqual(versions.map((version) => version.version_no), [4, 3, 2]);
});

test("completed employee eligibility remains unknown until database authorization evaluates the 24h window", () => {
  assert.deepEqual(personalWeeklyReopenEligibility({ status: "COMPLETED", employee_id: "owner" }, "owner", false), {
    eligible: null, reason: "unknown", isAdmin: false,
  });
  assert.deepEqual(personalWeeklyReopenEligibility({ status: "COMPLETED", employee_id: "owner" }, "admin", true), {
    eligible: true, reason: "available", isAdmin: true,
  });
});
