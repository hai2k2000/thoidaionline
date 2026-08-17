import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLegacyEvaluationInput } from "./legacyEvaluationValidation.ts";

const valid = {
  rating: 8,
  effortWeight: 3,
  completion: "done",
  onTime: true,
  opinion: "  useful  ",
  checkpointDate: "2026-08-14",
  isFinal: true,
};

test("strict legacy evaluation normalization returns a typed clean value", () => {
  assert.deepEqual(normalizeLegacyEvaluationInput(valid), {
    ...valid,
    opinion: "useful",
  });
});

test("strict legacy evaluation validation rejects malformed runtime values", () => {
  for (const overrides of [
    { rating: 7.5 },
    { rating: "8" },
    { effortWeight: 4 },
    { completion: "partial" },
    { onTime: 1 },
    { checkpointDate: "2026-02-30" },
    { isFinal: "true" },
    { opinion: { text: "unsafe" } },
    { opinion: "x".repeat(10001) },
  ]) {
    assert.throws(
      () => normalizeLegacyEvaluationInput({ ...valid, ...overrides }),
      RangeError,
    );
  }
});
