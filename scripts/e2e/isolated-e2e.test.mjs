import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/phase3b-isolated-e2e.yml", import.meta.url), "utf8");
const fixture = readFileSync(new URL("./start-sandbox.sh", import.meta.url), "utf8");
const httpSmoke = readFileSync(new URL("./http-smoke.mjs", import.meta.url), "utf8");
const browserSmoke = readFileSync(new URL("./browser-smoke.mjs", import.meta.url), "utf8");

test("isolated workflow is disposable and non-production", () => {
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /ubuntu-24\.04/);
  assert.match(workflow, /sandbox-e2e/);
  assert.match(workflow, /NO production credentials/);
  assert.match(workflow, /docker rm -f/);
  assert.doesNotMatch(workflow, /deploy-gate|systemctl restart|migration:apply/);
});

test("sandbox fixture uses pinned local-only services and RBAC V2 migration", () => {
  assert.match(fixture, /postgres:17\.2/);
  assert.match(fixture, /postgrest\/postgrest:v14\.7/);
  assert.match(fixture, /20261015100000_rbac_v2_role_user_overrides\.sql/);
  assert.match(fixture, /schema_migrations/);
  assert.match(fixture, /has_function_privilege/);
  assert.match(fixture, /grant select, insert, update, delete on all tables in schema public to service_role/);
  assert.match(fixture, /127\.0\.0\.1/);
  assert.match(fixture, /E2E_SESSION_SECRET/);
  assert.match(fixture, /add-mask.*session_secret/);
  assert.match(fixture, /add-mask.*test_password/);
  assert.doesNotMatch(fixture, /NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
});

test("authenticated smoke covers authorization and browser paths without printing credentials", () => {
  assert.match(httpSmoke, /api\/auth\/login/);
  assert.match(httpSmoke, /set_user_override/);
  assert.match(httpSmoke, /self override protection/);
  assert.match(browserSmoke, /#identifier/);
  assert.match(browserSmoke, /#password/);
  assert.doesNotMatch(httpSmoke, /console\.log\([^)]*password/);
  assert.match(workflow, /working-directory: \$\{\{ runner\.temp \}\}\/thoidai-old[\s\S]*?ROLE_LIFECYCLE_ENABLED: 'false'/);
  assert.match(workflow, /working-directory: \$\{\{ runner\.temp \}\}\/thoidai-new[\s\S]*?ROLE_LIFECYCLE_ENABLED: 'true'/);
});

test("browser runner install is disposable and does not rewrite application dependencies", () => {
  assert.match(workflow, /npm install --no-save --no-package-lock --ignore-scripts --legacy-peer-deps playwright@1\.51\.1/);
  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /Upload isolated E2E diagnostics/);
  assert.match(workflow, /include-hidden-files: false/);
  assert.match(workflow, /Isolated E2E diagnostic/);
  assert.match(workflow, /bcryptMatch/);
  assert.match(workflow, /legacyQuery/);
  assert.match(workflow, /actual-password-status/);
});
