import assert from "node:assert/strict";
import test from "node:test";

import { getStaffTier, sortStaffRows } from "./staffOrdering.ts";

const fixture = [
  { id: "employee-z", full_name: "Lê Zeta", role_code: "phong_vien", role_level: 1, job_title_code: "phong_vien", job_title_display_order: 50 },
  { id: "tbt", full_name: "Trần Tổng", role_code: "tbt_read_only", role_level: 0, job_title_code: "tong_bien_tap", job_title_display_order: 10 },
  { id: "manager-b", full_name: "Bùi Trưởng", role_code: "phu_trach_phong_bien_tap", role_level: 3, job_title_code: "phu_trach_phong_bien_tap", job_title_display_order: 30 },
  { id: "employee-a", full_name: "Đỗ Alpha", role_code: "phong_vien", role_level: 1, job_title_code: "phong_vien", job_title_display_order: 50 },
  { id: "admin", full_name: "Nguyễn Admin", role_code: "admin", role_level: 5, job_title_code: "admin", job_title_display_order: 5 },
  { id: "manager-a", full_name: "An Phó", role_code: "pho_tong_bien_tap", role_level: 3, job_title_code: "pho_tong_bien_tap", job_title_display_order: 20 },
];

test("leadership stays above managers and employees", () => {
  const rows = sortStaffRows(fixture);
  assert.deepEqual(rows.map((row) => row.id), ["admin", "tbt", "manager-a", "manager-b", "employee-a", "employee-z"]);
  assert.equal(getStaffTier(rows[0]), 1);
  assert.equal(getStaffTier(rows[1]), 1);
  assert.equal(getStaffTier(rows[2]), 2);
  assert.equal(getStaffTier(rows[4]), 3);
});

test("unknown leadership department is still a leadership tier", () => {
  assert.equal(getStaffTier({ full_name: "Lãnh đạo", role_code: "custom_leadership", department_code: "leadership" }), 1);
  assert.equal(getStaffTier({ full_name: "Trưởng phòng", role_code: "custom_leadership", department_code: "editorial", job_title_code: "truong_phong_tong_hop" }), 2);
});

test("names are alphabetic within a tier after level and display order", () => {
  const rows = sortStaffRows([
    { id: "2", full_name: "Bình", role_code: "phong_vien", role_level: 1, job_title_display_order: 50 },
    { id: "1", full_name: "Ánh", role_code: "phong_vien", role_level: 1, job_title_display_order: 50 },
  ]);
  assert.deepEqual(rows.map((row) => row.full_name), ["Ánh", "Bình"]);
});

test("positive list_order pins rows below the hierarchy in the requested order", () => {
  const rows = sortStaffRows([
    ...fixture,
    // Deliberately give pinned rows leadership metadata: the pin must remain
    // the primary key and must not depend on role/title/name.
    { id: "pinned-1", full_name: "Đoàn Thanh Hải", list_order: 1, role_code: "admin", role_level: 99 },
    { id: "pinned-2", full_name: "Hoàng Quỳnh Trang", list_order: 2, role_code: "tong_bien_tap", role_level: 99 },
    { id: "pinned-3", full_name: "Vũ Mai Anh", list_order: 3, role_code: "pho_tong_bien_tap", role_level: 99 },
  ]);

  assert.deepEqual(rows.slice(-3).map((row) => row.id), ["pinned-1", "pinned-2", "pinned-3"]);
  assert.deepEqual(rows.slice(0, -3).map((row) => row.id), ["admin", "tbt", "manager-a", "manager-b", "employee-a", "employee-z"]);
});
