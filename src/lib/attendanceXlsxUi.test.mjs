import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");
const exportRoute = readFileSync(new URL("../app/api/attendance/export/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");
const grid = readFileSync(new URL("../components/attendance/AttendanceMonthGrid.tsx", import.meta.url), "utf8");

test("forgot filter is accepted and matches both forgot status codes", () => {
  assert.match(route, /"forgot"/);
  assert.match(route, /forgot_card/);
  assert.match(route, /forgot_swipe/);
  assert.match(page, /<option value="forgot">Quên thẻ\/quẹt thẻ<\/option>/);
});

test("grid and popup expose QT and QQ actions and legend", () => {
  assert.match(grid, /text-amber-600/);
  assert.match(grid, /QT = Quên thẻ/);
  assert.match(grid, /QQ = Quên quẹt thẻ/);
  assert.match(page, /Quên thẻ \(QT\)/);
  assert.match(page, /Quên quẹt thẻ \(QQ\)/);
  assert.match(page, /appendAdminNoteQuickText/);
});

test("export route and page advertise xlsx", () => {
  assert.match(exportRoute, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(exportRoute, /cham-cong-\$\{month\}\.xlsx/);
  assert.match(page, />Xuất Excel<\/a>/);
  assert.doesNotMatch(page, /Xuất Excel \(CSV\)/);
});
