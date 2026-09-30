import assert from "node:assert/strict";
import test from "node:test";
import {
  canEditCreatorMutation,
  canCancelCreatorMutation,
  normalizeLifecycleState,
  taskLifecycleState,
} from "./creatorMutationPolicy.mjs";

test("pending creator may edit and cancel", () => {
  const input = { actorId: "u1", createdBy: "u1", isAdmin: false, state: "PENDING" };
  assert.equal(canEditCreatorMutation(input), true);
  assert.equal(canCancelCreatorMutation(input), true);
});

test("approved creator is blocked while admin may edit and cancel", () => {
  const input = { actorId: "u1", createdBy: "u1", isAdmin: false, state: "APPROVED" };
  assert.equal(canEditCreatorMutation(input), false);
  assert.equal(canCancelCreatorMutation(input), false);
  assert.equal(canEditCreatorMutation({ ...input, actorId: "admin", isAdmin: true }), true);
  assert.equal(canCancelCreatorMutation({ ...input, actorId: "admin", isAdmin: true }), true);
});

test("cancelled records are immutable even for admin", () => {
  const input = { actorId: "admin", createdBy: "u1", isAdmin: true, state: "CANCELLED" };
  assert.equal(canEditCreatorMutation(input), false);
  assert.equal(canCancelCreatorMutation(input), false);
});

test("missing creator and unknown state fail closed", () => {
  assert.equal(canEditCreatorMutation({ actorId: "u1", createdBy: null, isAdmin: false, state: "PENDING" }), false);
  assert.equal(normalizeLifecycleState("unexpected"), null);
});
test("task lifecycle uses done as the only final approval boundary", () => {
  for (const status of ["new", "in_progress", "blocked", "waiting", "rejected", "pending_review"]) {
    assert.equal(taskLifecycleState({ status, approval_required: true, assignment_approval_state: "approved", assignment_approved_at: "2026-09-30T10:00:00Z" }), "PENDING");
  }
  assert.equal(taskLifecycleState({ status: "done", approval_required: true, assignment_approval_state: "pending" }), "APPROVED");
  assert.equal(taskLifecycleState({ status: "cancelled", approval_required: true }), "CANCELLED");
  assert.equal(taskLifecycleState({ status: "unknown", approval_required: true }), null);
});

test("admin also fails closed when creator identity is missing", () => {
  assert.equal(canEditCreatorMutation({ actorId: "admin", createdBy: null, isAdmin: true, state: "APPROVED" }), false);
});
