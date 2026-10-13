import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");
const start = workflow.indexOf("      - name: Prepare canonical ref for lineage checks");
const end = workflow.indexOf("      - name: Setup Node", start);
assert.ok(start >= 0 && end > start, "canonical ref preparation step is present");
const step = workflow.slice(start, end);

test("canonical push validates the already-checked-out local branch without force-updating it", () => {
  assert.match(step, /git fetch origin integration\/production:refs\/remotes\/origin\/integration\/production/);
  assert.match(step, /git show-ref --verify --quiet refs\/heads\/integration\/production/);
  assert.match(step, /local_sha=\$\(git rev-parse refs\/heads\/integration\/production\)/);
  assert.match(step, /test "\$local_sha" = "\$remote_sha"/);
  assert.match(step, /Canonical ref mismatch/);
  assert.doesNotMatch(step, /git branch --force|git checkout|git reset/);
});

test("pull-request checkout creates only a missing local canonical ref and preserves HEAD", () => {
  assert.match(step, /git branch integration\/production "\$remote_sha"/);
  assert.match(step, /THOIDAI_REMOTE_HEAD=\$\(git rev-parse HEAD\)/);
  assert.match(step, /THOIDAI_INTEGRATION_COMMIT=\$remote_sha/);
});
