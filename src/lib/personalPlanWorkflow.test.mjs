import assert from "node:assert/strict";
import test from "node:test";
import { canReviewPersonalPlan, isPersonalScope } from "./personalPlanWorkflow.ts";

const base = { schedule_scope: "personal", approval_status: "PENDING_APPROVAL", created_by: "creator", department_id: "dept-a", approver_id: "manager-a" };

test("allows the current department manager and global approvers", () => {
  assert.deepEqual(canReviewPersonalPlan({ id: "manager-a", role_code: "staff", department_id: "dept-a" }, base), { ok: true });
  assert.deepEqual(canReviewPersonalPlan({ id: "global", role_code: "admin", department_id: "other" }, base), { ok: true });
});

test("denies self-review, cross-department managers, and non-pending rows", () => {
  assert.equal(canReviewPersonalPlan({ id: "creator", role_code: "admin", department_id: "dept-a" }, base).ok, false);
  assert.equal(canReviewPersonalPlan({ id: "manager-b", role_code: "staff", department_id: "dept-b" }, base).ok, false);
  assert.equal(canReviewPersonalPlan({ id: "manager-a", role_code: "staff", department_id: "dept-a" }, { ...base, approval_status: "APPROVED" }).ok, false);
});

test("requires global scope for a plan without an expected department manager", () => {
  assert.equal(canReviewPersonalPlan({ id: "manager-a", role_code: "staff", department_id: "dept-a" }, { ...base, approver_id: null }).ok, false);
  assert.equal(canReviewPersonalPlan({ id: "global", role_code: "pho_tong_bien_tap", department_id: null }, { ...base, approver_id: null }).ok, true);
});

test("recognizes only the personal discriminator", () => {
  assert.equal(isPersonalScope("personal"), true);
  assert.equal(isPersonalScope("organization"), false);
  assert.equal(isPersonalScope(null), false);
});
