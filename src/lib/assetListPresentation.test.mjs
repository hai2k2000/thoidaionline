import assert from "node:assert/strict";
import test from "node:test";
import { assetUsageState, closeEmployeeFilterState, filterAssetList, isAssetUnassigned, presentAssetCustody, resetEmployeeFilterState, summarizeAssetList } from "./assetListPresentation.ts";

const rows = Array.from({ length: 97 }, (_, index) => ({
  asset_name: index === 0 ? "Bộ bàn ghế sồi Nga dùng tại phòng họp tầng hai" : `Tài sản ${index + 1}`,
  category: index % 3 === 0 ? "CCDC" : index % 3 === 1 ? "TSC" : "MMTB",
  status: index < 76 ? "in_use" : "available",
  tracking_mode: index === 57 || index === 63 ? "lot" : "individual",
  quantity: index === 57 ? 17 : index === 63 ? 6 : 1,
  note: index === 76 ? "Chưa thuộc sở hữu phòng nào; cần xác định và bổ sung sau." : null,
  currentAssignment: index < 76 ? { department_id: `department-${index % 4}`, assignee_id: index % 5 ? `user-${index}` : null } : null,
}));

test("production-like 97 asset summary keeps the 76 assigned and 21 unassigned split", () => {
  assert.deepEqual(summarizeAssetList(rows), { total: 97, assigned: 76, unassigned: 21, liquidated: 0 });
  assert.equal(rows.filter((row) => row.tracking_mode === "lot").reduce((sum, row) => sum + row.quantity, 0), 23);
});

test("quick filters distinguish active custody, unassigned assets, and lots", () => {
  assert.equal(filterAssetList(rows, { name: "", category: "", status: "", quick: "in_use" }).length, 76);
  assert.equal(filterAssetList(rows, { name: "", category: "", status: "", quick: "unassigned" }).length, 21);
  assert.equal(filterAssetList(rows, { name: "", category: "", status: "", quick: "lot" }).length, 2);
  assert.equal(filterAssetList(rows, { name: "sồi nga", category: "", status: "", quick: "all" }).length, 1);
});

test("department-only custody is assigned while an absent active assignment is unassigned", () => {
  assert.equal(isAssetUnassigned(rows[0]), false);
  assert.equal(rows[0].currentAssignment.assignee_id, null);
  assert.equal(isAssetUnassigned(rows[76]), true);
});

test("only available assets without custody are unassigned", () => {
  assert.equal(isAssetUnassigned({ status: "in_use", currentAssignment: null }), true);
  assert.equal(isAssetUnassigned({ status: "maintenance", currentAssignment: null }), true);
  assert.equal(isAssetUnassigned({ status: "broken", currentAssignment: null }), true);
  assert.equal(isAssetUnassigned({ status: "available", currentAssignment: null }), true);
});

test("usage state follows custody truth despite status drift and preserves liquidated", () => {
  assert.equal(assetUsageState({ status: "in_use", currentAssignment: null }), "unassigned");
  assert.equal(assetUsageState({ status: "available", currentAssignment: { department_id: "dept", assignee_id: null } }), "assigned");
  assert.equal(assetUsageState({ status: "liquidated", currentAssignment: null }), "liquidated");
  assert.deepEqual(summarizeAssetList([
    { status: "in_use", currentAssignment: null },
    { status: "available", currentAssignment: { department_id: "dept", assignee_id: null } },
    { status: "liquidated", currentAssignment: null },
  ]), { total: 3, assigned: 1, unassigned: 1, liquidated: 1 });
});

test("employee filter state resets department-dependent selection and closes outside", () => {
  const state = { assigneeId: "employee-1", search: "nguyen", activeIndex: 3, open: true };
  assert.deepEqual(resetEmployeeFilterState(state), { assigneeId: "", search: "", activeIndex: 0, open: false });
  assert.deepEqual(closeEmployeeFilterState({ ...state, open: true }), { ...state, open: false });
});

test("shared filter remains scoped to the selected department", () => {
  const shared = { status: "in_use", currentAssignment: { department_id: "dept-a", assignee_id: null } };
  const otherDepartment = { status: "in_use", currentAssignment: { department_id: "dept-b", assignee_id: null } };
  assert.deepEqual(filterAssetList([shared, otherDepartment], { name: "", category: "", quick: "all", departmentId: "dept-a", assigneeId: "__shared" }), [shared]);
});

test("custody presentation keeps view-only labels and shared/unassigned semantics", () => {
  assert.deepEqual(presentAssetCustody({
    status: "in_use",
    currentAssignment: { department_id: "dept-content", assignee_id: "user-manager" },
    assigned_department_name: "Phòng Nội dung",
    assignee_name: "Hoàng Văn Mạnh",
  }), { department: "Phòng Nội dung", person: "Hoàng Văn Mạnh", unassigned: false });
  assert.deepEqual(presentAssetCustody({
    status: "in_use",
    currentAssignment: { department_id: "dept-content", assignee_id: null },
    assigned_department_name: "Phòng Nội dung",
  }), { department: "Phòng Nội dung", person: "Tài sản dùng chung", unassigned: false });
  assert.deepEqual(presentAssetCustody({ status: "available", currentAssignment: null }), { department: "Chưa xác định phòng", person: "Cần bổ sung sau", unassigned: true });
});
