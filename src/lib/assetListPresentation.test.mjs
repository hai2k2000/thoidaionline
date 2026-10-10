import assert from "node:assert/strict";
import test from "node:test";
import { filterAssetList, isAssetUnassigned, summarizeAssetList } from "./assetListPresentation.ts";

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
  assert.deepEqual(summarizeAssetList(rows), { total: 97, assigned: 76, unassigned: 21 });
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
