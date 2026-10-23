import assert from "node:assert/strict";
import test from "node:test";
import {
  approvalQueueParams,
  presentWorkflowAction,
  workflowErrorMessage,
  validateReturnReason,
} from "./approvalUi.mjs";

test("approval queue keeps server scope and requests pending records", () => {
  assert.deepEqual(approvalQueueParams({ q: "hợp đồng", categoryId: "dept-1" }), {
    q: "hợp đồng",
    status: "pending_review",
    categoryId: "dept-1",
  });
});

test("return reason validation rejects blank or too-short reasons", () => {
  assert.equal(validateReturnReason(""), "Cần nhập lý do trả lại hồ sơ.");
  assert.equal(validateReturnReason("ab"), "Lý do trả lại phải có ít nhất 3 ký tự.");
  assert.equal(validateReturnReason("Thiếu tài liệu"), "");
});

test("workflow errors distinguish validation, permission, and stale conflicts", () => {
  assert.equal(workflowErrorMessage(400, "return_reason_required"), "Cần nhập lý do trả lại hồ sơ.");
  assert.equal(workflowErrorMessage(403, "permission_denied"), "Bạn không có quyền xử lý hồ sơ này.");
  assert.equal(workflowErrorMessage(409, "invalid_transition"), "Hồ sơ đã thay đổi trạng thái. Hãy tải lại trước khi thao tác.");
});

test("workflow history uses Vietnamese labels and preserves return reasons", () => {
  assert.deepEqual(presentWorkflowAction({ action: "approve", new_data: { status: "approved" } }), {
    label: "Phê duyệt hồ sơ",
    reason: "",
  });
  assert.deepEqual(presentWorkflowAction({ action: "return_for_correction", new_data: { reason: "Thiếu tài liệu" } }), {
    label: "Trả lại chỉnh sửa",
    reason: "Thiếu tài liệu",
  });
});

test("workflow history labels self-approval explicitly", () => {
  assert.deepEqual(presentWorkflowAction({ action: "approve", new_data: { status: "approved", self_approval: true } }), {
    label: "Tự phê duyệt hồ sơ",
    reason: "",
  });
});
