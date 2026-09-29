import assert from "node:assert/strict";
import test from "node:test";
import { parseDutyRosterWorkbook } from "./dutyRosterExcel.mjs";

function dayNumberFor(week, day) {
  return week * 7 + day + 1;
}

function cellRows() {
  const rows = [
    ["Lịch trực tháng 10/2026"],
    ["Từ ngày 01-31/10/2026"],
    ["*Ghi chú"],
    ["Nhân sự/Ngày", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"],
  ];
  for (let week = 0; week < 5; week += 1) {
    const header = Array(8).fill(null);
    for (let day = 0; day < 7; day += 1) {
      const dayNumber = dayNumberFor(week, day);
      if (dayNumber <= 31) header[day + 1] = new Date(Date.UTC(2026, 9, dayNumber));
    }
    rows.push(header);
    for (const position of ["Xuất bản", "Biên tập", "Phóng viên"]) {
      const row = [position];
      for (let day = 0; day < 7; day += 1) row.push(dayNumberFor(week, day) <= 31 ? `${position}-${week}-${day}` : null);
      rows.push(row);
    }
  }
  rows.push([], [], [], []);
  return rows;
}

test("parses the month matrix into one assignment per date and position", () => {
  const result = parseDutyRosterWorkbook({ sheets: [{ name: "Trang tính1", rows: cellRows() }] });
  assert.equal(result.month, "2026-10");
  assert.equal(result.rows.length, 93);
  assert.deepEqual(result.rows[0], { date: "2026-10-01", position: "Xuất bản", name: "Xuất bản-0-0" });
  assert.equal(result.rows.at(-1).date, "2026-10-31");
});

test("rejects a workbook without the required three duty positions", () => {
  const rows = cellRows();
  rows[6][0] = "Sai vị trí";
  assert.throws(() => parseDutyRosterWorkbook({ sheets: [{ name: "Trang tính1", rows }] }), /position|vị trí/i);
});

test("ignores formatted but empty rows after the template", () => {
  const result = parseDutyRosterWorkbook({ sheets: [{ name: "Trang tính1", rows: cellRows().concat(Array.from({ length: 900 }, () => [])) }] });
  assert.equal(result.rows.length, 93);
});
