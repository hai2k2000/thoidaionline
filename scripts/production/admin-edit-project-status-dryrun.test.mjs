import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("admin project status rehearsal has restore, behavior, ACL, revert and reapply gates", () => {
  const script = readFileSync("scripts/production/admin-edit-project-status-dryrun.sh", "utf8");
  const post = readFileSync("scripts/production/admin-edit-project-status/post/20261107140000_admin_edit_project_task_status.sql", "utf8");
  const behavior = readFileSync("supabase/tests/admin_edit_project_task_status_behaviour.sql", "utf8");
  const revert = readFileSync("scripts/production/admin-edit-project-status-revert.sql", "utf8");
  for (const token of [
    "THOIDAI_ADMIN_EDIT_PROJECT_STATUS_DRYRUN_APPROVED",
    "disk_guard_require",
    "docker run",
    "--memory 512m",
    "pg_isready -h 127.0.0.1 -U supabase_admin -d postgres",
    "leftover dry-run container exists",
    "create schema if not exists supabase_migrations",
    "restore_counts",
    "restore_acl",
    "safe-apply-migration.sh",
    "postcondition.stderr",
    "step=behaviour",
    "step=idempotency",
    "step=revert",
    "step=reapply",
  ]) assert.ok(script.includes(token), token);
  assert.ok(script.indexOf("create schema if not exists supabase_migrations") < script.indexOf("pg_restore"));
  for (const signature of [
    "api_admin_edit_task_unchecked(uuid,uuid,text,text,date,date,time,text,text,text,text)",
    "api_admin_edit_task(uuid,uuid,text,text,date,date,time,text,text,text,text)",
    "api_admin_set_task_participants(uuid,uuid,uuid,uuid[],uuid[],uuid,text)",
    "api_admin_delete_task_attachment(uuid,uuid,uuid,text)",
    "api_add_task_attachment(uuid,uuid,text,text,text,bigint)",
  ]) assert.ok(script.includes(signature), signature);
  assert.match(script, /api_admin_edit_task_unchecked[\s\S]*revoke all/);
  assert.match(script, /api_admin_edit_task\([\s\S]*grant execute[\s\S]*to service_role/);
  for (const token of ["to_regprocedure", "prosecdef", "proowner", "aclexplode", "has_function_privilege('anon'", "has_function_privilege('authenticated'", "has_function_privilege('service_role'", "'pass' else 'fail'"]) assert.ok(post.includes(token), token);
  for (const token of ["new", "in_progress", "pending_review", "done", "rejected", "status unchanged", "project completion"]) assert.ok(behavior.includes(token), token);
  assert.match(revert, /drop function if exists public\.api_admin_edit_task_unchecked/);
});
