import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

for (const path of ["../app/api/permissions/users/[userId]/route.ts", "../app/api/permissions/users/[userId]/history/route.ts"]) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  test(`${path} has server-side approval read contract`, () => {
    assert.match(source, /requireReadActor/);
    assert.match(source, /loadRbacActor/);
    assert.match(source, /permission\.manage/);
    assert.match(source, /asUuid/);
    assert.match(source, /p_admin:\s*guard\.actor\.id/);
    assert.doesNotMatch(source, /p_admin:\s*(?:params|searchParams|request|body|userId)/);
  });
}

test("approval routes call the exact RPCs", () => {
  assert.match(readFileSync(new URL("../app/api/permissions/users/[userId]/route.ts", import.meta.url), "utf8"), /api_list_user_approval_permissions/);
  assert.match(readFileSync(new URL("../app/api/permissions/users/[userId]/history/route.ts", import.meta.url), "utf8"), /api_list_user_permission_history/);
});
