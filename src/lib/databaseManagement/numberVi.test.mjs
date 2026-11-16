import test from "node:test";
import assert from "node:assert/strict";
import { formatGroupedInput, formatGroupedNumber, parseGroupedNumber, usesGroupedNumber } from "./numberVi.mjs";

test("money fields group thousands with dots", () => {
  assert.equal(formatGroupedNumber(33000000), "33.000.000");
  assert.equal(formatGroupedNumber(999), "999");
  assert.equal(formatGroupedNumber(-1500), "-1.500");
  assert.equal(formatGroupedNumber(1234.5), "1.234,5");
});

test("typed text parses back to a number", () => {
  assert.equal(parseGroupedNumber("33.000.000"), 33000000);
  assert.equal(parseGroupedNumber("33000000"), 33000000);
  assert.equal(parseGroupedNumber("1.234,5"), 1234.5);
  assert.equal(parseGroupedNumber(""), "");
  assert.equal(parseGroupedNumber("abc"), null);
});

test("input regroups while typing", () => {
  assert.equal(formatGroupedInput("3300000"), "3.300.000");
  assert.equal(formatGroupedInput("33.0000"), "330.000");
  assert.equal(formatGroupedInput("1234,"), "1.234,");
  assert.equal(formatGroupedInput("12a"), null);
});

test("year fields keep plain digits", () => {
  assert.equal(usesGroupedNumber({ data_type: "number", label: "Tổng giá trị thanh toán (đồng)" }), true);
  assert.equal(usesGroupedNumber({ data_type: "number", label: "Năm tài chính" }), false);
  assert.equal(usesGroupedNumber({ data_type: "number", label: "Năm" }), false);
  assert.equal(usesGroupedNumber({ data_type: "text", label: "Số hợp đồng" }), false);
});
