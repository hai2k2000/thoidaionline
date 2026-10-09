import assert from "node:assert/strict";
import test from "node:test";
import { businessDateFromTimestamp, formatDateOnlyVN } from "./businessDate.mjs";

test("date-only formatting never shifts calendar day", () => {
  assert.equal(formatDateOnlyVN("2026-10-07"), "07/10/2026");
  assert.equal(formatDateOnlyVN("2026-10-01"), "01/10/2026");
});

test("Vietnam midnight timestamp keeps the local business date", () => {
  assert.equal(businessDateFromTimestamp("2026-09-30T17:00:00.000Z"), "2026-10-01");
});

test("invalid date-only values are rejected", () => {
  assert.throws(() => formatDateOnlyVN("2026-10-1"), /invalid date/i);
});
