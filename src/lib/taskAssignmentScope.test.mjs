import assert from "node:assert/strict";
import test from "node:test";

import { deriveAssignmentScope } from "./taskAssignmentScope.mjs";

const departments = [
  { id: "editorial", code: "editorial", name: "Phòng Nội dung" },
  { id: "board", code: "leadership", name: "Ban Biên tập" },
  { id: "external", code: "external", name: "Phòng Đối ngoại" },
];

test("department-scoped approvers are locked to their authenticated department", () => {
  assert.deepEqual(deriveAssignmentScope({ roleCode: "truong_phong", departmentId: "editorial" }, departments), {
    kind: "own_department",
    departmentId: "editorial",
    departmentName: "Phòng Nội dung",
    canChooseOtherDepartment: false,
  });
});

test("TBT and PTBT default to the canonical editorial board and may explicitly switch", () => {
  for (const roleCode of ["tong_bien_tap", "pho_tong_bien_tap"]) {
    assert.deepEqual(deriveAssignmentScope({ roleCode, departmentId: "editorial" }, departments), {
      kind: "global_default",
      departmentId: "board",
      departmentName: "Ban Biên tập",
      canChooseOtherDepartment: true,
    });
  }
});

test("admin keeps the existing global scope without an invented default department", () => {
  assert.deepEqual(deriveAssignmentScope({ roleCode: "admin", departmentId: "editorial" }, departments), {
    kind: "global_default",
    departmentId: null,
    departmentName: null,
    canChooseOtherDepartment: true,
  });
});

test("scope derives department IDs from canonical data and tolerates missing membership", () => {
  assert.deepEqual(deriveAssignmentScope({ roleCode: "truong_phong", departmentId: "missing" }, departments), {
    kind: "own_department",
    departmentId: null,
    departmentName: null,
    canChooseOtherDepartment: false,
  });
});
