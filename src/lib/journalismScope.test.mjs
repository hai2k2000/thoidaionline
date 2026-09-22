import assert from "node:assert/strict";
import test from "node:test";
import { canAccessJournalismScope, canUseJournalism } from "./journalismScope.mjs";

test("Journalism scope requires Content department or approved editorial leadership", () => {
  assert.equal(canAccessJournalismScope({ roleCode: "phong_vien", departmentCode: "content" }), true);
  assert.equal(canAccessJournalismScope({ roleCode: "truong_phong", departmentCode: "business" }), false);
  assert.equal(canAccessJournalismScope({ roleCode: "pho_tong_bien_tap", departmentCode: "business" }), true);
  assert.equal(canAccessJournalismScope({ roleCode: "nhan_vien", departmentCode: null }), false);
});

test("Journalism permission remains required inside the department", () => {
  assert.equal(canUseJournalism({ roleCode: "phong_vien", departmentCode: "content", rbacPermissions: ["journalism.publication.verify"] }), true);
  assert.equal(canUseJournalism({ roleCode: "phong_vien", departmentCode: "content", rbacPermissions: ["task.view"] }), false);
  assert.equal(canUseJournalism({ roleCode: "pho_tong_bien_tap", departmentCode: "business", rbacPermissions: ["journalism.publication.manage"] }), true);
});
