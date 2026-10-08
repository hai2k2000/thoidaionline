import test from "node:test";
import assert from "node:assert/strict";
import {
  boundPersonalWeeklyVersions,
  buildPersonalWeeklyReopenRpcArgs,
  normalizePersonalWeeklyReopenReason,
  normalizePersonalWeeklyEligibility,
} from "./personalWeeklyReport.ts";
import { readFileSync } from "node:fs";

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

test("database eligibility result maps employee and admin decisions, failing closed on malformed data", () => {
  assert.deepEqual(normalizePersonalWeeklyEligibility({ eligible: true, reason: "available", is_admin: false }), {
    eligible: true, reason: "available", isAdmin: false,
  });
  assert.deepEqual(normalizePersonalWeeklyEligibility({ eligible: false, reason: "expired", is_admin: false }), {
    eligible: false, reason: "expired", isAdmin: false,
  });
  assert.deepEqual(normalizePersonalWeeklyEligibility({ eligible: true, reason: "available", is_admin: true }), {
    eligible: true, reason: "available", isAdmin: true,
  });
  assert.deepEqual(normalizePersonalWeeklyEligibility(null), {
    eligible: false, reason: "unknown", isAdmin: false,
  });
  assert.deepEqual(normalizePersonalWeeklyEligibility({ eligible: true, reason: "invalid", is_admin: true }), {
    eligible: false, reason: "unknown", isAdmin: true,
  });
});

test("report loads pass only the server actor and report id to eligibility RPC", () => {
  const repository = readFileSync(new URL("./personalWeeklyReportRepository.ts", import.meta.url), "utf8");
  assert.match(repository, /db\.rpc\("api_personal_weekly_reopen_eligibility",\s*\{\s*p_actor:\s*actorId,\s*p_report_id:\s*report\.id\s*\}\)/);
  assert.doesNotMatch(repository, /personalWeeklyReopenEligibility\(/);
  assert.doesNotMatch(repository, /Date\.now\(|new Date\(\)/);
});
