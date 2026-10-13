import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/phase3b-isolated-e2e.yml", import.meta.url), "utf8");
const fixture = readFileSync(new URL("./start-sandbox.sh", import.meta.url), "utf8");
const httpSmoke = readFileSync(new URL("./http-smoke.mjs", import.meta.url), "utf8");
const browserSmoke = readFileSync(new URL("./browser-smoke.mjs", import.meta.url), "utf8");
const gateway = readFileSync(new URL("./sandbox-gateway.mjs", import.meta.url), "utf8");
const sdkProbe = readFileSync(new URL("./supabase-sdk-probe.mjs", import.meta.url), "utf8");

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
  assert.match(fixture, /20261015120000_quick_report_rpc_payload_compatibility\.sql/);
  assert.match(fixture, /20260814190000_phase1_authorization_facade\.sql/);
  assert.match(fixture, /20260813110000_task_evaluation_checkpoints\.sql/);
  assert.match(fixture, /20260817050000_phase3_additive_task_schema\.sql/);
  assert.match(fixture, /20260820090000_task_assignment_reviewer_daily_due_time\.sql/);
  assert.match(fixture, /20260924120000_task_approval_gates\.sql/);
  assert.match(fixture, /20260924130000_task_assignment_semantics\.sql/);
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
  assert.match(httpSmoke, /title=HTTP E2E status/);
  assert.match(httpSmoke, /title=Quick Report E2E status/);
  assert.match(httpSmoke, /title=Permission catalog response/);
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
  assert.match(workflow, /gateway\.log/);
  assert.match(workflow, /node \"\$GITHUB_WORKSPACE\/scripts\/e2e\/sandbox-gateway\.mjs\"/);
  assert.match(workflow, /legacyBcryptMatch/);
  assert.match(workflow, /env ROLE_LIFECYCLE_ENABLED=false PORT=3102/);
  assert.match(workflow, /env ROLE_LIFECYCLE_ENABLED=true TASK_RBAC_V2_ENABLED=true PORT=3103/);
});

test("Supabase sandbox gateway preserves the real SDK REST prefix contract", () => {
  assert.match(gateway, /127\.0\.0\.1/);
  assert.match(gateway, /sandbox gateway target must be localhost HTTP/);
  assert.match(gateway, /startsWith\("\/rest\/v1"\)/);
  assert.match(gateway, /request\.url\.slice\(prefix\.length\)/);
  assert.match(gateway, /request\.headers/);
  assert.match(gateway, /sandbox gateway error body/);
  assert.match(sdkProbe, /createClient/);
  assert.match(sdkProbe, /direct root endpoint unexpectedly accepted/);
  assert.match(sdkProbe, /sandbox gateway did not satisfy/);
  assert.match(sdkProbe, /directHttpStatus/);
  assert.match(sdkProbe, /gatewayHttpStatus/);
  assert.match(sdkProbe, /authQueryError/);
  assert.match(sdkProbe, /authQueryHash/);
  assert.match(sdkProbe, /sessionQueryError/);
  assert.match(sdkProbe, /sessionQueryStatus/);
  assert.match(workflow, /node (?:\"\$GITHUB_WORKSPACE\/)?scripts\/e2e\/sandbox-gateway\.mjs/);
  assert.match(workflow, /E2E_GATEWAY_PORT=\"\$\{E2E_SUPABASE_URL##\*:\}\" node (?:\"\$GITHUB_WORKSPACE\/)?scripts\/e2e\/sandbox-gateway\.mjs/);
  assert.match(workflow, /node scripts\/e2e\/supabase-sdk-probe\.mjs/);
  assert.match(workflow, /echo \"E2E_SUPABASE_URL=http:\/\/127\.0\.0\.1:\$\{gateway_port\}\" >> \"\$RUNNER_TEMP\/thoidai-e2e\.env\"/);
  assert.doesNotMatch(workflow, /gateway_port=\$\(sed -n .*E2E_SUPABASE_URL/);
  assert.match(workflow, /NEXT_PUBLIC_SUPABASE_URL=\"\$E2E_SUPABASE_URL\"/);
  assert.doesNotMatch(workflow, /NEXT_PUBLIC_SUPABASE_URL=\"\$E2E_POSTGREST_URL\"/);
  assert.match(workflow, /cleanup_gateway\(\) \{ kill \"\$gateway_pid\" 2>\/dev\/null \|\| true; wait \"\$gateway_pid\" 2>\/dev\/null \|\| true; \}/);
  assert.match(workflow, /gateway_port=\$\(\(21000 \+ \(\$\$ % 500\)\)\)/);
  assert.match(workflow, /gateway_port=\$\(\(22000 \+ \(GITHUB_RUN_ID % 500\)\)\)/);
  assert.match(workflow, /gateway_port=\$\(\(23000 \+ \(GITHUB_RUN_ID % 500\)\)\)/);
  assert.match(workflow, /Build old application with sandbox public endpoint[\s\S]*?gateway_port=\$\(\(22000 \+ \(GITHUB_RUN_ID % 500\)\)\)/);
  assert.match(workflow, /Build new RBAC V2 application with sandbox public endpoint[\s\S]*?gateway_port=\$\(\(23000 \+ \(GITHUB_RUN_ID % 500\)\)\)/);
  assert.match(workflow, /title=New app log/);
  assert.match(workflow, /title=Sandbox gateway/);
  assert.match(workflow, /Diagnose isolated new-app E2E failure/);
  assert.match(workflow, /thoidai-new-http\.log/);
  assert.match(workflow, /thoidai-new-browser\.log/);
  assert.match(workflow, /New HTTP failure/);
  assert.match(workflow, /Browser failure/);
  assert.match(workflow, /working-directory: \$\{\{ runner\.temp \}\}\/thoidai-new[\s\S]*?node \"\$GITHUB_WORKSPACE\/scripts\/e2e\/sandbox-gateway\.mjs\"/);
});
