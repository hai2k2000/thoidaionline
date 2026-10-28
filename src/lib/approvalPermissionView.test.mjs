import assert from "node:assert/strict";
import test from "node:test";

import {
  APPROVAL_PERMISSION_CODES,
  APPROVAL_PERMISSION_LABELS,
  APPROVAL_PERMISSION_DESCRIPTIONS,
  SOURCE_LABELS,
  defaultGrantScope,
  isNarrowingAllow,
  previewSentence,
  historyLine,
  requiresTypedConfirmation,
} from "./approvalPermissionView.mjs";

test("approval catalog exposes the three codes and Vietnamese copy", () => {
  assert.deepEqual(APPROVAL_PERMISSION_CODES, ["leave.approve", "schedule.business.approve", "schedule.event.approve"]);
  for (const code of APPROVAL_PERMISSION_CODES) {
    assert.equal(typeof APPROVAL_PERMISSION_LABELS[code], "string");
    assert.equal(typeof APPROVAL_PERMISSION_DESCRIPTIONS[code], "string");
    assert.equal(defaultGrantScope(code), "department");
  }
  assert.deepEqual(SOURCE_LABELS, { role: "Vai trò", structural: "Chức vụ Trưởng phòng", user_allow: "Cấp riêng", user_deny: "Chặn riêng", none: "Không có" });
});

test("narrowing allow compares inherited union", () => {
  assert.equal(isNarrowingAllow(["all"], [], "department"), true);
  assert.equal(isNarrowingAllow(["department"], ["department"], "department"), false);
  assert.equal(isNarrowingAllow([], [], "all"), false);
});

test("preview handles none, inactive, all, restrictions and several permissions", () => {
  assert.equal(previewSentence([], "Mai"), "Người này hiện không có quyền duyệt đơn hoặc kế hoạch nào.");
  assert.equal(previewSentence([{ permissionCode: "schedule.business.approve", label: "Duyệt kế hoạch công tác cá nhân", effectiveScopes: ["department"], effectiveDepartment: { name: "Phòng X" }, restrictions: [] }], "Mai"), "Người này duyệt được: kế hoạch công tác cá nhân của nhân sự Phòng X.");
  assert.match(previewSentence([{ permissionCode: "leave.approve", effectiveScopes: ["self"], restrictions: ["no_self_approval", "unknown_code"] }], "Mai"), /trừ hồ sơ của chính mình/);
  assert.doesNotMatch(previewSentence([{ permissionCode: "leave.approve", effectiveScopes: ["self"], restrictions: ["no_self_approval", "unknown_code"] }], "Mai"), /no_self_approval|unknown_code/);
  assert.match(previewSentence([{ permissionCode: "leave.approve", label: "Duyệt đơn xin nghỉ", effectiveScopes: ["all"], restrictions: ["leave_ge_3_days_tbt_only"] }, { permissionCode: "schedule.event.approve", label: "Duyệt kế hoạch sự kiện cá nhân", effectiveScopes: ["department"], effectiveDepartment: { name: "Phòng X" }, restrictions: [] }], "Mai"), /toàn cơ quan/);
  assert.match(previewSentence([{ permissionCode: "leave.approve", effectiveScopes: ["all"], restrictions: ["leave_ge_3_days_tbt_only"] }], "Mai", { active: false }), /không hoạt động/);
});

test("history line describes actions and before-after values", () => {
  const line = historyLine({ actor: { name: "An" }, action: "set_permission_override", newData: { permission_code: "leave.approve", old: { effect: "deny", scope: "all" }, new: { effect: "allow", scope: "department" } }, oldData: null }, { "leave.approve": "Duyệt đơn xin nghỉ" });
  assert.match(line, /An/); assert.match(line, /Duyệt đơn xin nghỉ/); assert.match(line, /phòng ban/); assert.match(line, /Chặn riêng.*toàn cơ quan.*→.*Cấp riêng.*phòng ban/);
  assert.match(historyLine({ actor: { name: "An" }, action: "clear_permission_override", newData: { permission_code: "leave.approve", old: { effect: "allow", scope: "department" } }, oldData: null }, {}), /Cấp riêng.*phòng ban.*→.*Kế thừa/);
  assert.match(historyLine({ actor: { name: "An" }, action: "restore_permission_inheritance", newData: { old: [{ permissionId: "p1", effect: "allow", scope: "all" }], changed: 1 }, oldData: null }, {}), /khôi phục tất cả về mặc định \(1 mục\)/);
  assert.match(historyLine({ actor: { name: "An" }, action: "grant_permission", newData: { permission_code: "leave.approve", scope: "department", changed: 1 }, oldData: null }, {}), /cấp.*phòng ban/);
});

test("typed confirmation is required only for all-scope allows", () => {
  assert.equal(requiresTypedConfirmation("allow", "all"), true);
  assert.equal(requiresTypedConfirmation("allow", "department"), false);
  assert.equal(requiresTypedConfirmation("deny", "all"), false);
});
