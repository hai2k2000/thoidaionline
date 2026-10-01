import assert from "node:assert/strict";
import test from "node:test";
import { parseOnlineWorkWorkbook, resolveOnlineWorkImport } from "./onlineWorkExcel.mjs";

const rows = [
  ["TẠP CHÍ THỜI ĐẠI"], ["LỊCH LÀM VIỆC ONLINE TỔ NGOẠI NGỮ"], ["1/10/2026"],
  ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"],
  [null, null, null, "1/10/2026", "2/10/2026", "3/10/2026", "4/10/2026"],
  [null, null, null, "Trung", "Nga", "Các tổ làm online", "Các tổ làm online"],
  ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"],
  ["5/10/2026", "6/10/2026", "7/10/2026", "8/10/2026", "9/10/2026", "10/10/2026", "11/10/2026"],
  ["Lào", "Khmer", "Trung", "Nga", "Anh", "Các tổ làm online", "Các tổ làm online"],
];

test("parses the first sheet and preserves month assignments", () => {
  const parsed = parseOnlineWorkWorkbook({ sheets: [{ rows }, { rows: [["ignore"]] }] });
  assert.equal(parsed.month, "2026-10");
  assert.equal(parsed.days.length, 11);
  assert.deepEqual(parsed.days.find((day) => day.date === "2026-10-01")?.groups, ["Trung"]);
  assert.deepEqual(parsed.days.find((day) => day.date === "2026-10-03")?.groups, ["Các tổ làm online"]);
});

test("resolves language groups to all matching foreign reporters", () => {
  const people = [
    { id: "en", username: "thuphuong" }, { id: "zh1", username: "thithuy" }, { id: "zh2", username: "ngocanh" },
    { id: "lo", username: "minhduc" }, { id: "kh", username: "ducanh" }, { id: "ru", username: "bachduong" },
  ];
  const parsed = { month: "2026-10", days: [{ date: "2026-10-01", groups: ["Trung"] }, { date: "2026-10-03", groups: ["Các tổ làm online"] }] };
  const result = resolveOnlineWorkImport(parsed, people);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.days[0].staffIds, ["zh1", "zh2"]);
  assert.deepEqual(result.days[1].staffIds, ["en", "zh1", "zh2", "lo", "kh", "ru"]);
});