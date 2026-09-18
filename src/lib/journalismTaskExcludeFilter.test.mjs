import assert from "node:assert/strict";
import test from "node:test";
import { applyJournalismExcludeFilter } from "./taskFilters.mjs";

test("journalism exclude targets the selected REST relation alias", () => {
  const calls = [];
  const query = {
    is(column, value) {
      calls.push({ column, value });
      return this;
    },
  };

  assert.equal(applyJournalismExcludeFilter(query), query);
  assert.deepEqual(calls, [{ column: "journalism", value: null }]);
});
