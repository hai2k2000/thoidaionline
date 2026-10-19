import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");

test("non-PR codex pushes use bounded non-production Supabase placeholders", () => {
  assert.match(workflow, /node scripts\/check-ci-build-env\.mjs/);
  assert.match(workflow, /https:\/\/ci\.invalid\/supabase/);
  assert.match(workflow, /THOIDAI_BUILD_CONFIG:[^\n]*ci-placeholder/);
  assert.doesNotMatch(workflow, /NEXT_PUBLIC_SUPABASE_(?:URL|ANON_KEY):\s*\$\{\{\s*secrets\./);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\./);
});
