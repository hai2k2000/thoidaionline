import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionRecord, transitionRecord } from "./approvalWorkflow.mjs";

const owner = { id: "owner", permissions: ["record.edit"] };
const approver = { id: "approver", permissions: ["record.approve"], permissionScopes: { "record.approve": ["all"] } };
const selfApprover = { id: "owner", permissions: ["record.approve", "record.self_approve"], permissionScopes: { "record.approve": ["all"], "record.self_approve": ["self"] } };
const departmentApprover = { id: "approver", department_id: "dept-a", permissions: ["record.approve"], permissionScopes: { "record.approve": ["department"] } };
const allApprover = { id: "approver", department_id: "dept-a", permissions: ["record.approve"], permissionScopes: { "record.approve": ["all"] } };

test("allows draft submission and records a pending-review transition", () => {
  assert.deepEqual(canTransitionRecord(owner, { status: "draft", created_by: "owner" }, "submit"), { ok: true });
  assert.deepEqual(transitionRecord({ status: "draft", created_by: "owner" }, owner, "submit"), { status: "pending_review", action: "submit_review", reason: null });
});

test("requires approve permission, ACL approval, and a different actor", () => {
  assert.equal(canTransitionRecord(owner, { status: "pending_review", created_by: "owner", aclApprove: true }, "approve").ok, false);
  assert.equal(canTransitionRecord(approver, { status: "pending_review", created_by: "approver", aclApprove: true }, "approve").reason, "self_approval_forbidden");
  assert.deepEqual(transitionRecord({ status: "pending_review", created_by: "owner", aclApprove: true }, approver, "approve"), { status: "approved", action: "approve", reason: null });
});

test("department approval follows the record department while managers and all scope remain allowed", () => {
  const a = { status: "pending_review", created_by: "owner", department_id: "dept-a", department_manager_id: null, aclApprove: true };
  const b = { ...a, department_id: "dept-b" };
  assert.equal(canTransitionRecord(departmentApprover, a, "approve").ok, true);
  assert.equal(canTransitionRecord(departmentApprover, b, "approve").reason, "permission_denied");
  assert.equal(canTransitionRecord(departmentApprover, b, "return", "Thiếu tài liệu").reason, "permission_denied");
  assert.equal(canTransitionRecord(allApprover, b, "approve").ok, true);
  assert.equal(canTransitionRecord({ id: "manager", department_id: "dept-a", permissions: [], permissionScopes: {} }, { ...a, department_manager_id: "manager" }, "approve").ok, true);
  assert.equal(canTransitionRecord({ ...departmentApprover, department_id: null }, a, "approve").reason, "permission_denied");
});

test("allows creator self-approval only with the dedicated scoped permission", () => {
  const record = { status: "pending_review", created_by: "owner", aclApprove: true };
  assert.deepEqual(transitionRecord(record, selfApprover, "approve"), { status: "approved", action: "approve", reason: null });
  assert.equal(canTransitionRecord({ id: "owner", permissions: ["record.approve"], permissionScopes: { "record.approve": ["all"] } }, record, "approve").reason, "self_approval_forbidden");
  assert.equal(canTransitionRecord({ id: "owner", permissions: ["record.self_approve"], permissionScopes: { "record.self_approve": ["self"] } }, record, "approve").reason, "permission_denied");
});

test("fails closed when the self-approval permission has no effective scopes", () => {
  const record = { status: "pending_review", created_by: "owner", aclApprove: true };
  const missingScopes = { id: "owner", permissions: ["record.approve", "record.self_approve"], permissionScopes: { "record.approve": ["all"] } };
  const emptyScopes = { id: "owner", permissions: ["record.approve", "record.self_approve"], permissionScopes: { "record.approve": ["all"], "record.self_approve": [] } };
  assert.equal(canTransitionRecord(missingScopes, record, "approve").reason, "self_approval_forbidden");
  assert.equal(canTransitionRecord(emptyScopes, record, "approve").reason, "self_approval_forbidden");
});

test("requires a reason when returning a pending record to draft", () => {
  assert.equal(canTransitionRecord(approver, { status: "pending_review", created_by: "owner", aclApprove: true }, "return").reason, "return_reason_required");
  assert.deepEqual(transitionRecord({ status: "pending_review", created_by: "owner", aclApprove: true }, approver, "return", "Thiếu tài liệu đối chiếu"), { status: "draft", action: "return_for_correction", reason: "Thiếu tài liệu đối chiếu" });
});

test("rejects invalid transitions and makes repeated desired state idempotent", () => {
  assert.equal(canTransitionRecord(approver, { status: "approved", created_by: "owner", aclApprove: true }, "approve").reason, "invalid_transition");
  assert.deepEqual(transitionRecord({ status: "approved", created_by: "owner", aclApprove: true }, approver, "approve"), { status: "approved", action: "approve", reason: null, replayed: true });
});
