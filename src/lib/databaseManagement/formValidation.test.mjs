import assert from "node:assert/strict";
import test from "node:test";
import { validateRecordForm } from "./formValidation.mjs";

const fields = [
  { field_key: "required_name", data_type: "text", required: true, label: "Tên" },
  { field_key: "website", data_type: "url", required: true, label: "Trang web" },
  { field_key: "classification", data_type: "select", required: true, options: [{ value: "public", label: "Công khai" }], label: "Phân loại" },
];

test("form validation returns every missing or invalid field in one pass", () => {
  const errors = validateRecordForm({ mode: "create", categoryId: "", recordTypeId: "", title: "", metadata: { website: "http://bad", classification: "wrong" }, fields });
  assert.deepEqual(errors.map((error) => error.field), ["categoryId", "recordTypeId", "title", "metadata.required_name", "metadata.website", "metadata.classification"]);
});

test("form validation accepts a complete typed form", () => {
  const errors = validateRecordForm({ mode: "create", categoryId: "cat-1", recordTypeId: "type-1", title: "Hồ sơ", metadata: { required_name: "A", website: "https://example.com", classification: "public" }, fields });
  assert.deepEqual(errors, []);
});
