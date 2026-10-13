import assert from "node:assert/strict";
import test from "node:test";
import * as contracts from "./required-api-contracts.mjs";
const { REQUIRED_API_CONTRACTS, validateContractResponse } = contracts;

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

test("events and attendance contracts use the production response shape and valid date query", () => {
  const events = REQUIRED_API_CONTRACTS.find(({ name }) => name === "event-assignment");
  const attendance = REQUIRED_API_CONTRACTS.find(({ name }) => name === "attendance");
  assert.match(events.path, /\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(validateContractResponse(events, { status: 200 }, { rows: [] }).ok, true);
  assert.equal(typeof contracts.resolveContractPath, "function");
  assert.match(contracts.resolveContractPath(attendance, new Date("2026-10-13T00:00:00.000Z")), /^\/api\/attendance\?date=\d{4}-\d{2}-\d{2}&period=day&scope=personal$/);
  assert.deepEqual(validateContractResponse(attendance, { status: 200 }, { rows: [], monthlyRows: [] }).ok, true);
  assert.deepEqual(validateContractResponse(attendance, { status: 200 }, { rows: [] }).ok, false);
});

test("journalism authorization follows canUseJournalism and requires 200 with shape when allowed", () => {
  const contract = REQUIRED_API_CONTRACTS.find(({ name }) => name === "journalism-calendar");
  const allowed = { role_code: "admin", department_code: null, rbacPermissions: ["journalism.metadata.update"] };
  assert.equal(typeof contracts.canUseJournalismForSmoke, "function");
  assert.equal(contracts.canUseJournalismForSmoke(allowed), true);
  assert.deepEqual(validateContractResponse(contract, { status: 200 }, { calendar: [] }, { sessionUser: allowed }).ok, true);
  assert.equal(validateContractResponse(contract, { status: 403 }, { error: "forbidden" }, { sessionUser: allowed }).ok, false);
  assert.equal(validateContractResponse(contract, { status: 200 }, { topics: [] }, { sessionUser: allowed }).ok, false);
  for (const status of [401, 400, 500]) assert.equal(validateContractResponse(contract, { status }, { calendar: [] }, { sessionUser: allowed }).ok, false, `status ${status}`);
});

test("journalism authorization accepts only 403 when the session is not allowed", () => {
  const contract = REQUIRED_API_CONTRACTS.find(({ name }) => name === "journalism-topics");
  const denied = { role_code: "admin", department_code: null, rbacPermissions: [] };
  assert.equal(typeof contracts.canUseJournalismForSmoke, "function");
  assert.equal(contracts.canUseJournalismForSmoke(denied), false);
  assert.deepEqual(validateContractResponse(contract, { status: 403 }, { error: "forbidden" }, { sessionUser: denied }).ok, true);
  for (const status of [200, 401, 400, 500]) assert.equal(validateContractResponse(contract, { status }, { topics: [] }, { sessionUser: denied }).ok, false, `status ${status}`);
});

test("non-journalism contracts never treat authorization or server errors as pass", () => {
  const contract = REQUIRED_API_CONTRACTS.find(({ name }) => name === "attendance");
  for (const status of [401, 403, 400, 500]) assert.equal(validateContractResponse(contract, { status }, { rows: [] }).ok, false, `status ${status}`);
  assert.equal(validateContractResponse(contract, { status: 200 }, { rows: [], monthlyRows: [] }).ok, true);
});

test("session contract requires an authenticated user object", () => {
  const contract = REQUIRED_API_CONTRACTS.find(({ name }) => name === "session");
  const user = { role_code: "nhan_vien", department_code: null, rbacPermissions: [] };
  assert.equal(validateContractResponse(contract, { status: 200 }, { user }).ok, true);
  assert.equal(validateContractResponse(contract, { status: 200 }, { user: null }).ok, false);
  assert.equal(validateContractResponse(contract, { status: 200 }, { user: [] }).ok, false);
  assert.equal(validateContractResponse(contract, { status: 200 }, { user: { role_code: "nhan_vien", department_code: null } }).ok, false);
});
