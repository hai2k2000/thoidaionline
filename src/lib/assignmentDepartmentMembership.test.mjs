import assert from "node:assert/strict";
import test from "node:test";
import { assignmentMemberDepartmentIds } from "./assignmentDepartmentMembership.mjs";

const cases = [
  ["truong_phong", null, ["dept-x"]],
  [null, "truong_phong", ["dept-x", "leadership"]],
  ["pho_tong_bien_tap", null, ["dept-x", "leadership"]],
  [null, "pho_truong_phong", ["dept-x"]],
  ["phong_vien", null, ["dept-x"]],
];

for (const [roleCode, jobTitleCode, expected] of cases) {
  test(`${roleCode ?? jobTitleCode} belongs to its real department and applicable leadership department`, () => {
    assert.deepEqual(assignmentMemberDepartmentIds({ departmentId: "dept-x", roleCode, jobTitleCode, leadershipDepartmentId: "leadership" }), expected);
  });
}

test("leadership membership works without a real department", () => {
  assert.deepEqual(assignmentMemberDepartmentIds({ departmentId: null, roleCode: "pho_tong_bien_tap", jobTitleCode: null, leadershipDepartmentId: "leadership" }), ["leadership"]);
});
