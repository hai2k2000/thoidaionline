import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");
const packager = readFileSync("scripts/package-standalone.mjs", "utf8");

test("canonical branch uses public Supabase config without production service-role secrets", () => {
  assert.match(workflow, /THOIDAI_BUILD_CONFIG: \$\{\{ \(github\.event_name == 'pull_request' \|\| github\.ref == 'refs\/heads\/integration\/production'\)/);
  assert.match(workflow, /vars\.THOIDAI_PUBLIC_SUPABASE_URL/);
  assert.match(workflow, /vars\.THOIDAI_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY: ci-service-role-key-placeholder/);
  assert.match(workflow, /check-canonical-build-env\.mjs/);
  assert.match(packager, /canonical-public artifact requires valid public Supabase configuration/);
});
