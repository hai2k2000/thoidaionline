import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("print route is a server-authorized reuse of TaskDetailDto", () => {
  const route = read("../app/tasks/[id]/print/page.tsx");
  const access = read("./taskPrintAccess.ts");
  assert.match(route, /getSessionUser/);
  assert.match(route, /loadPrintableTask/);
  assert.match(route, /taskRepository\.access/);
  assert.match(route, /taskRepository\.detail/);
  assert.match(route, /canTaskAction/);
  assert.match(route, /redirect\("\/tasks"\)/);
});

test("print sheet includes A4 fields, signatures, and print controls", () => {
  const sheet = read("../components/WorkAssignmentPrintSheet.tsx");
  const actions = read("../components/PrintActions.tsx");
  const css = read("../app/globals.css");
  for (const label of [
    "PHIẾU GIAO VIỆC", "Mã công việc", "Ngày giao", "Phòng ban", "Người giao việc",
    "Người nhận việc", "Người phối hợp", "Hạn hoàn thành", "Mức độ ưu tiên", "Ghi chú",
    "NGƯỜI GIAO VIỆC", "NGƯỜI NHẬN VIỆC", "NGƯỜI PHỐI HỢP", "In phiếu", "Save / Export PDF",
  ]) assert.match(`${sheet}\n${actions}`, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(css, /@page\s*\{[\s\S]*size:\s*A4/);
  assert.match(css, /break-inside:\s*avoid/);
  assert.match(sheet, /print:hidden/);
  assert.match(sheet, /journalism/);
});

test("Task Detail and Task Summary expose the print action", () => {
  const detail = read("../components/TaskDetailShell.tsx");
  const summary = read("../components/TaskCenterShell.tsx");
  assert.match(detail, /Xuất phiếu giao việc/);
  assert.match(detail, /\/tasks\/\$\{task\.id\}\/print/);
  assert.match(summary, /Xuất phiếu giao việc/);
  assert.match(summary, /\/tasks\/\$\{task\.id\}\/print/);
});
