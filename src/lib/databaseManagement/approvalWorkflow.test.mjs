import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionRecord, transitionRecord } from "./approvalWorkflow.mjs";

const owner = { id: "owner", permissions: ["record.edit"] };
const approver = { id: "approver", permissions: ["record.approve"] };

test("allows draft submission and records a pending-review transition", () => {
  assert.deepEqual(canTransitionRecord(owner, { status: "draft", created_by: "owner" }, "submit"), { ok: true });
  assert.deepEqual(transitionRecord({ status: "draft", created_by: "owner" }, owner, "submit"), { status: "pending_review", action: "submit_review", reason: null });
});

test("requires approve permission, ACL approval, and a different actor", () => {
  assert.equal(canTransitionRecord(owner, { status: "pending_review", created_by: "owner", aclApprove: true }, "approve").ok, false);
  assert.equal(canTransitionRecord(approver, { status: "pending_review", created_by: "approver", aclApprove: true }, "approve").reason, "self_approval_forbidden");
  assert.deepEqual(transitionRecord({ status: "pending_review", created_by: "owner", aclApprove: true }, approver, "approve"), { status: "approved", action: "approve", reason: null });
});

test("requires a reason when returning a pending record to draft", () => {
  assert.equal(canTransitionRecord(approver, { status: "pending_review", created_by: "owner", aclApprove: true }, "return").reason, "return_reason_required");
  assert.deepEqual(transitionRecord({ status: "pending_review", created_by: "owner", aclApprove: true }, approver, "return", "Thiếu tài liệu đối chiếu"), { status: "draft", action: "return_for_correction", reason: "Thiếu tài liệu đối chiếu" });
});

test("rejects invalid transitions and makes repeated desired state idempotent", () => {
  assert.equal(canTransitionRecord(approver, { status: "approved", created_by: "owner", aclApprove: true }, "approve").reason, "invalid_transition");
  assert.deepEqual(transitionRecord({ status: "approved", created_by: "owner", aclApprove: true }, approver, "approve"), { status: "approved", action: "approve", reason: null, replayed: true });
});
