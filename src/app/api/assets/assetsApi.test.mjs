import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("asset APIs resolve server sessions and reject task-wide permission fallback", () => {
  for (const path of ["./route.ts", "./[id]/route.ts"]) {
    const source = read(path);
    assert.match(source, /getSessionUser/);
    assert.match(source, /serverSupabase|assetRepository/);
    assert.doesNotMatch(source, /can_edit_all_tasks/);
    assert.doesNotMatch(source, /body\??\.actorId|body\??\[.actorId/);
  }
});

test("asset API supports explicit lifecycle actions and same-origin mutations", () => {
  const route = read("./route.ts");
  assert.match(route, /isSameOriginRequest/);
  for (const action of ["assign", "transfer", "return"]) assert.match(route, new RegExp(action));
  assert.match(route, /canManageAssets/);
});

test("asset audit uses the asset-specific module and lifecycle actions", () => {
  const [route, detail, audit] = [read("./route.ts"), read("./[id]/route.ts"), read("../../../lib/serverAudit.ts")];
  assert.match(audit, /"assets"/);
  for (const action of ["create", "update", "assign", "transfer", "return"]) {
    assert.match(`${route}\n${detail}`, new RegExp(action));
  }
});

test("asset options are limited to active departments", () => {
  const route = read("./route.ts");
  assert.match(route, /departments/);
  assert.match(route, /active/);
});

test("ordinary asset list enriches visible custody without exposing options directory", () => {
  const route = read("./route.ts");
  assert.match(route, /listAssetsForActor/);
  assert.match(route, /options.*1/);
  assert.match(route, /canManageAssets/);
});
