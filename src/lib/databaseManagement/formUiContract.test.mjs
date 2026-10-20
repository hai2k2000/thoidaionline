import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../components/DatabaseRecordForm.tsx", import.meta.url), "utf8");
const listPage = readFileSync(new URL("../../app/database/records/page.tsx", import.meta.url), "utf8");

test("dynamic record form renders typed controls instead of one universal text input", () => {
  for (const type of ["long_text", "select", "country", "department", "multi_select", "date", "datetime", "number", "url"]) assert.match(page, new RegExp(`data_type === \"${type}\"`));
  assert.match(page, /selectedOptions/);
  assert.match(page, /type=\{inputType\}/);
});

test("create form supports drag and drop, removing selected files, and retry messaging", () => {
  assert.match(page, /onDragOver/);
  assert.match(page, /onDrop/);
  assert.match(page, /Xóa tệp/);
  assert.match(page, /Tổng số tệp/);
  assert.match(page, /Xem hồ sơ đã lưu/);
});

test("record form recovers from network failures and focuses local validation errors", () => {
  assert.match(page, /catch \{/);
  assert.match(page, /Không thể kết nối máy chủ/);
  assert.match(page, /firstErrorRef\.current\?\.focus\(\)/);
});

test("record list translates status values for staff", () => {
  assert.match(listPage, /statusLabels/);
  assert.match(listPage, /statusLabels\[row\.status\]/);
});
