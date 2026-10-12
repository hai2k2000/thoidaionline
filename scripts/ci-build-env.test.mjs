import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");

test("CI build uses bounded non-production Supabase placeholders", () => {
  assert.match(workflow, /node scripts\/check-ci-build-env\.mjs/);
  assert.match(workflow, /NEXT_PUBLIC_SUPABASE_URL: https:\/\/ci\.invalid\/supabase/);
  assert.doesNotMatch(workflow, /NEXT_PUBLIC_SUPABASE_(?:URL|ANON_KEY):\s*\$\{\{\s*secrets\./);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\./);
});
