import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_API_CONTRACTS, validateContractResponse } from "./required-api-contracts.mjs";

test("critical API contract inventory includes every protected list family", () => {
  for (const name of ["tasks-normal", "tasks-journalism", "tasks-assignment-approval", "tasks-completion-approval", "personal-schedule", "work-schedule", "event-assignment", "journalism-calendar", "journalism-topics", "journalism-series", "attendance", "notifications", "session"]) {
    assert.ok(REQUIRED_API_CONTRACTS.some((contract) => contract.name === name), name);
  }
});

test("empty lists are valid when the documented response shape is present", () => {
  const contract = REQUIRED_API_CONTRACTS.find(({ name }) => name === "tasks-normal");
  assert.deepEqual(validateContractResponse(contract, { status: 200 }, { tasks: [] }), { ok: true });
});

test("500, auth failures, and malformed payloads fail the contract", () => {
  const contract = REQUIRED_API_CONTRACTS.find(({ name }) => name === "personal-schedule");
  assert.equal(validateContractResponse(contract, { status: 500 }, { error: "x" }).ok, false);
  assert.equal(validateContractResponse(contract, { status: 401 }, { error: "x" }).ok, false);
  assert.equal(validateContractResponse(contract, { status: 200 }, { rows: [] }).ok, true);
  assert.equal(validateContractResponse(contract, { status: 200 }, []).ok, false);
});
