import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateRecordForm } from "./formValidation.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("people multi-select keeps earlier names that are no longer in the list", () => {
  const field = { field_key: "nguoi_thuc_hien", label: "Người thực hiện", data_type: "multi_select", required: false, options: [{ value: "Trần Thị Nhị", label: "Trần Thị Nhị" }], validation: { peopleOptions: true } };
  const base = { mode: "edit", title: "Hợp đồng", fields: [field] };
  assert.deepEqual(validateRecordForm({ ...base, metadata: { nguoi_thuc_hien: ["Nguyễn Quỳnh Trang"] } }).filter((error) => error.field.includes("nguoi_thuc_hien")), []);
  const plain = { ...field, validation: {} };
  assert.equal(validateRecordForm({ ...base, fields: [plain], metadata: { nguoi_thuc_hien: ["Nguyễn Quỳnh Trang"] } }).filter((error) => error.field.includes("nguoi_thuc_hien")).length, 1);
});

test("catalog fills peopleOptions fields with staff plus extra names", () => {
  const route = read("../../app/api/database/catalog/route.ts");
  assert.match(route, /usesPeopleOptions\(field\.validation\) \? \[\.\.\.\(people \?\? \[\]\)/);
});
