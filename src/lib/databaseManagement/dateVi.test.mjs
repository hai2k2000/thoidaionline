import assert from "node:assert/strict";
import test from "node:test";
import { formatIsoDateVi, formatViDateInput, parseViDate } from "./dateVi.mjs";

test("formats ISO dates", () => { assert.equal(formatIsoDateVi("2026-12-31"), "31/12/2026"); assert.equal(formatIsoDateVi("x"), "x"); });
test("parses valid dates", () => { assert.equal(parseViDate("1/2/2026"), "2026-02-01"); assert.equal(parseViDate("01-02-2026"), "2026-02-01"); assert.equal(parseViDate("01.02.2026"), "2026-02-01"); assert.equal(parseViDate("29/02/2024"), "2024-02-29"); });
test("rejects invalid dates", () => { for (const value of ["31/02/2026", "29/02/2025", "32/01/2026"]) assert.equal(parseViDate(value), null); });
test("formats input while typing", () => {
  assert.equal(formatViDateInput("3"), "3");
  assert.equal(formatViDateInput("3112"), "31/12");
  assert.equal(formatViDateInput("31122026"), "31/12/2026");

  let typed = "";
  for (const character of "01022026") typed = formatViDateInput(typed + character);
  assert.equal(typed, "01/02/2026");

  assert.equal(formatViDateInput("01/02/".slice(0, -1)), "01/02");
  assert.equal(formatViDateInput("1/2/2026"), "1/2/2026");
  assert.equal(parseViDate(formatViDateInput("1/2/2026")), "2026-02-01");
  assert.equal(formatViDateInput("1-2-2026"), "1/2/2026");
});
