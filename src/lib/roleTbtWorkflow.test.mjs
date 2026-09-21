import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/20260819123000_role_lifecycle_and_tbt_direct.sql", "utf8");
const permissions = fs.readFileSync("src/app/api/permissions/route.ts", "utf8");
const session = fs.readFileSync("src/lib/serverSession.ts", "utf8");
const directPublish = fs.readFileSync("supabase/migrations/20260819152000_tbt_direct_publish.sql", "utf8");

test("TBT direct publish remains role and permission guarded", () => {
  assert.match(migration, /r\.code='tong_bien_tap'/);
  assert.match(migration, /can_evaluate_step2/);
  assert.match(migration, /awaiting_manager','awaiting_tbt/);
  assert.match(directPublish, /awaiting_manager','awaiting_tbt/);
  assert.match(directPublish, /status='published'/);
  assert.match(directPublish, /publish_tbt_direct/);
  assert.doesNotMatch(directPublish, /return 'awaiting_manager'/);
});

test("role lifecycle is atomic and protects admin", () => {
  assert.match(migration, /api_create_role/);
  assert.match(migration, /api_set_role_active/);
  assert.match(migration, /admin role cannot be locked/);
  assert.match(permissions, /status/);
  assert.match(session, /ROLE_LIFECYCLE_ENABLED/);
  assert.match(session, /roleLifecycleEnabled[\s\S]*active/);
});
