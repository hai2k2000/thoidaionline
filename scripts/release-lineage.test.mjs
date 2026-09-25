import assert from "node:assert/strict";
import test from "node:test";
import { assertReleaseLineage, parseReleaseLineage } from "./release-lineage.mjs";

test("accepts a candidate descended from current production on integration branch", () => {
  assert.doesNotThrow(() => assertReleaseLineage({
    candidateCommit: "c".repeat(40),
    currentProductionCommit: "a".repeat(40),
    integrationCommit: "b".repeat(40),
    candidateBranch: "integration/production",
    candidateDescendsFromProduction: true,
    integrationContainsProduction: true,
  }));
});

test("rejects a stale candidate even when it descends from the old baseline", () => {
  assert.throws(() => assertReleaseLineage({
    candidateCommit: "c".repeat(40),
    currentProductionCommit: "a".repeat(40),
    integrationCommit: "b".repeat(40),
    candidateBranch: "feature/stale",
    candidateDescendsFromProduction: false,
    integrationContainsProduction: true,
  }), /current production/);
});

test("rejects artifacts built from a feature branch", () => {
  assert.throws(() => assertReleaseLineage({
    candidateCommit: "c".repeat(40),
    currentProductionCommit: "a".repeat(40),
    integrationCommit: "b".repeat(40),
    candidateBranch: "feature/new-ui",
    candidateDescendsFromProduction: true,
    integrationContainsProduction: true,
  }), /integration\/production/);
});

test("parses lineage metadata without accepting secret values", () => {
  assert.deepEqual(parseReleaseLineage([
    "commit=abc",
    "current_production_parent=def",
    "integration_branch=integration/production",
  ].join("\n")), {
    commit: "abc",
    current_production_parent: "def",
    integration_branch: "integration/production",
  });
});
