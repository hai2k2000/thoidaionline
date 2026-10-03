import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Task management keeps operational controls under the correct title", () => {
  const source = read("../components/TaskCenterShell.tsx");
  assert.match(source, /QUẢN LÝ CÔNG VIỆC/);
  assert.doesNotMatch(source, /BẢNG TỔNG HỢP CÔNG VIỆC/);
  assert.match(source, /Xem công việc theo:/);
  for (const label of ["+ Tạo công việc", "Công việc thường", "Chờ duyệt giao việc", "Chờ duyệt hoàn thành"]) assert.match(source, new RegExp(label.replace("+", "\\+")));
});

test("Work Report remains employee-centered, navigable, and read-only", () => {
  const source = read("../components/WorkReportPage.tsx");
  assert.match(source, /Báo cáo khối lượng và kết quả công việc theo nhân viên\/phòng/);
  assert.match(source, /openEmployee/);
  assert.match(source, /\/tasks\/\$\{row\.id\}\?returnTo=/);
  assert.doesNotMatch(source, /edit Task|approve Task|cancel Task|Chốt kỳ|Tạo kế hoạch/);
});

test("Department Plan summary is Plan-centered and Word-only", () => {
  const report = read("../components/DepartmentPlanReport.tsx");
  const shell = read("../components/DepartmentPlanShell.tsx");
  assert.match(report, /TỔNG KẾT KỲ/);
  assert.match(shell, /Tổng kết kỳ/);
  assert.match(report, /Chốt kỳ/);
  assert.match(report, /Xuất báo cáo Word/);
  assert.match(report, /reports\/docx/);
  assert.doesNotMatch(report, /Xuất PDF|reports\/pdf/);
  assert.match(report, /departmentPlanUrl\(period\.periodType, period\.periodStart, departmentId\)/);
});

test("Excel import, template download, and duplicate Plan guard remain intact", () => {
  const actions = read("../components/DepartmentPlanActions.tsx");
  for (const label of ["Import kế hoạch từ Excel", "Tải file Excel mẫu", "Kế hoạch kỳ này đã tồn tại.", "Mở kế hoạch", "Đóng"]) assert.match(actions, new RegExp(label.replace(".", "\\.")));
  assert.match(actions, /accept="\.xlsx"/);
});
