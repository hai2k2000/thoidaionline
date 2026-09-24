import assert from "node:assert/strict";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] || process.cwd());
for (const path of ["server.js", ".next/BUILD_ID", ".next/server/app-paths-manifest.json", ".next/static", ".next/cache", "public", "start-standalone.mjs", "required-route-manifest.json", "RELEASE_BASELINE_COMMIT", "MIGRATION_REFERENCE", ".release-meta"]) assert.ok(existsSync(join(root, path)), `missing artifact path: ${path}`);
assert.equal(readFileSync(join(root, "RELEASE_BASELINE_COMMIT"), "utf8").trim(), "e501652e969900b97938acccd8f998df4e5d1873", "artifact baseline mismatch");
assert.equal(readFileSync(join(root, "MIGRATION_REFERENCE"), "utf8").trim(), "supabase/migrations/20260924120000_task_approval_gates.sql", "artifact migration mismatch");
const releaseMeta = readFileSync(join(root, ".release-meta"), "utf8");
assert.match(releaseMeta, /protection=managed/);
assert.match(releaseMeta, /build_verification=production-like-env-build-pass/);
assert.match(releaseMeta, /env_model=symlink:/);
const routes = JSON.parse(readFileSync(join(root, "required-route-manifest.json"), "utf8"));
const appPaths = JSON.parse(readFileSync(join(root, ".next/server/app-paths-manifest.json"), "utf8"));
for (const { routePath } of routes) assert.ok(Object.hasOwn(appPaths, `${routePath}/route`), `missing artifact route: ${routePath}`);
for (const name of [".env.local", ".env.production"]) { const path = join(root, name); assert.ok(lstatSync(path).isSymbolicLink(), `${name} must remain a symlink`); assert.ok(readlinkSync(path), `${name} symlink target is empty`); }
console.log("standalone-artifact: PASS");
