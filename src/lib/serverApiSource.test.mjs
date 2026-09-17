import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./serverApi.ts", import.meta.url),
  "utf8",
);
const responseSource = readFileSync(
  new URL("./apiResponse.ts", import.meta.url),
  "utf8",
);

test("mutation guard checks origin before signed session", () => {
  const mutationSource = source.slice(
    source.indexOf("export async function requireMutationActor"),
  );
  const originIndex = mutationSource.indexOf("isSameOriginRequest()");
  const sessionIndex = mutationSource.indexOf("getSessionUser()");
  assert.ok(originIndex >= 0);
  assert.ok(sessionIndex > originIndex);
  assert.match(source, /invalid_origin/);
  assert.match(source, /unauthenticated/);
});

test("API responses are private no-store and errors are stable", () => {
  assert.match(responseSource, /private, no-store/);
  for (const code of [
    "invalid_origin",
    "unauthenticated",
    "forbidden",
    "invalid_request",
    "not_found",
    "conflict",
    "operation_failed",
  ]) {
    assert.match(`${source}\n${responseSource}`, new RegExp(code));
  }
  assert.doesNotMatch(`${source}\n${responseSource}`, /error\.message/);
  assert.doesNotMatch(`${source}\n${responseSource}`, /console\.(?:log|warn|error)/);
});

test("server API has no unrelated UUID or authorization imports", () => {
  assert.doesNotMatch(source, /randomUUID|canAssignToDepartment|canTaskAction/);
});

test("UUID validation is centralized", () => {
  assert.match(source, /UUID_PATTERN/);
  assert.match(source, /export function asUuid/);
});
const permissionsRoute = readFileSync(
  new URL("../app/api/permissions/route.ts", import.meta.url),
  "utf8",
);

test("permission API is server-grant authorized and read-only", () => {
  assert.match(permissionsRoute, /loadRbacActor/);
  assert.match(permissionsRoute, /permission\.manage/);
  assert.match(permissionsRoute, /permissions/);
  assert.match(permissionsRoute, /role_permission_grants/);
  assert.match(permissionsRoute, /requireReadActor/);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.match(permissionsRoute, new RegExp(`export async function ${method}`));
    assert.match(permissionsRoute, new RegExp(`${method}[\\s\\S]{0,300}405`));
  }
});
