import { cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { REQUIRED_PRODUCTION_ROUTES } from "../src/lib/requiredProductionRoutes.mjs";

const root = process.cwd();
const build = join(root, ".next");
const standalone = join(build, "standalone");
const buildId = (await readFile(join(build, "BUILD_ID"), "utf8")).trim();
const baselineText = await readFile(join(root, "scripts/check-release-baseline.mjs"), "utf8");
const canonicalBaseline = baselineText.match(/canonicalBaseline = "([^"]+)"/)?.[1];
const output = resolve(process.env.STANDALONE_ARTIFACT_DIR || join(root, ".artifacts", "standalone", `${buildId}-${Date.now()}`));
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();

if (!existsSync(standalone)) throw new Error("Next standalone output is missing; run next build first.");
if (!canonicalBaseline) throw new Error("canonical baseline is missing from check-release-baseline.mjs");
if (existsSync(output)) throw new Error(`artifact already exists: ${output}`);
execFileSync(process.execPath, ["scripts/check-required-routes.mjs"], { cwd: root, stdio: "inherit" });
await mkdir(output, { recursive: true });
await cp(standalone, output, { recursive: true });
await cp(join(build, "static"), join(output, ".next", "static"), { recursive: true });
if (existsSync(join(root, "public"))) await cp(join(root, "public"), join(output, "public"), { recursive: true });
const sharedRoot = process.env.THOIDAI_SHARED_ROOT || "/opt/thoidai-work";
for (const name of [".env.local", ".env.production"]) {
  await rm(join(output, name), { force: true });
  await symlink(join(sharedRoot, name), join(output, name));
}
await cp(join(root, "scripts", "start-standalone.mjs"), join(output, "start-standalone.mjs"));
await cp(join(root, "scripts", "verify-standalone-artifact.mjs"), join(output, "verify-standalone-artifact.mjs"));
await mkdir(join(output, "scripts", "production"), { recursive: true });
for (const name of ["build-standalone-release.sh", "mark-release-success.sh", "release-retention.sh"]) {
  await cp(join(root, "scripts", "production", name), join(output, "scripts", "production", name));
}
await rm(join(output, "scripts", "check-required-routes.mjs"), { force: true });
await cp(join(root, "scripts", "check-release-baseline.mjs"), join(output, "scripts", "check-release-baseline.mjs"));
await writeFile(join(output, "RELEASE_BASELINE_COMMIT"), `${canonicalBaseline}\n`);
await writeFile(join(output, "required-route-manifest.json"), `${JSON.stringify(REQUIRED_PRODUCTION_ROUTES, null, 2)}\n`);
await writeFile(join(output, "package.json"), `${JSON.stringify({ name: "thoidai-work-runtime", version: "0.1.0", private: true, scripts: { start: "node start-standalone.mjs" } }, null, 2)}\n`);
const artifactBytes = execFileSync("du", ["-sb", output], { encoding: "utf8" }).trim().split(/\s+/, 1)[0];
await writeFile(join(output, ".release-meta"), [
  `release_id=${buildId}-standalone`,
  `commit=${commit}`,
  `created_at=${new Date().toISOString()}`,
  "artifact_type=next-standalone",
  `canonical_baseline=${canonicalBaseline}`,
  `artifact_bytes=${artifactBytes}`,
  "protection=managed",
  "rollback_eligible=yes",
  "health_status=pending",
  "deploy_status=pending",
  "rollback_role=unassigned",
  "",
].join("\n"));
execFileSync(process.execPath, [join(output, "verify-standalone-artifact.mjs"), output], { stdio: "inherit" });
console.log(`standalone-artifact: ${output}`);
