import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { canAccessTaskAssignment } from "./taskAssignAccess.ts";

test("assignment shell requires the explicit canonical permission", () => {
  assert.equal(canAccessTaskAssignment({ can_assign_task: true }), true);
  assert.equal(canAccessTaskAssignment({ can_assign_task: false }), false);
  assert.equal(canAccessTaskAssignment({}), false);
});

test("assignment page uses server session and redirects denied users", () => {
  const source = fs.readFileSync(
    new URL("../app/tasks/assign/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /await getSessionUser\(\)/);
  assert.match(source, /redirect\("\/login"\)/);
  assert.match(source, /redirect\("\/tasks"\)/);
  assert.match(source, /can_assign_task/);
  assert.doesNotMatch(source, /@\/lib\/supabase/);
});
