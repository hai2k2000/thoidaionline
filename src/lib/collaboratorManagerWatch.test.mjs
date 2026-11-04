import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261105230000_collaborator_manager_watch.sql", "utf8");
const dryrun = readFileSync("scripts/production/collaborator-manager-watch-dryrun.sh", "utf8");

test("manager watcher migration keeps owner failures and skips collaborator gaps", () => {
  const old = readFileSync("supabase/migrations/20261103160000_projects_v1.sql", "utf8");
  const body = source => source.slice(source.indexOf("create or replace function public.enforce_assignee_manager_watcher()"), source.indexOf("alter function public.enforce_assignee_manager_watcher()"));
  assert.equal(body(migration).replaceAll("\n   if new.assignment_role='assignee' then return new; end if;\n   raise", " raise").replace(/\r/g, ""), body(old).replace(/\r/g, ""));
  assert.doesNotMatch(migration, /(?:create|drop|alter)\s+(?:constraint\s+)?trigger/i);
  assert.match(migration, /new\.assignment_role='assignee' then return new/);
  assert.match(migration, /if v_department is null then[\s\S]*raise exception/);
  assert.match(migration, /if v_manager is null then[\s\S]*raise exception/);
  assert.match(migration, /project_id is not null|v_project_id is not null/);
  assert.match(migration, /task_category='duty'/);
  assert.match(migration, /assignment_role not in \('owner','assignee'\)/);
  assert.match(migration, /security definer set search_path=public,pg_temp/);
  assert.match(migration, /alter function public\.enforce_assignee_manager_watcher\(\) owner to postgres/);
  assert.match(migration, /revoke all on function public\.enforce_assignee_manager_watcher/);
});

test("manager watcher dry-run is fail-closed and applies only the reserved migration", () => {
  assert.match(dryrun, /COLLABORATOR_MANAGER_WATCH_DRYRUN_APPROVED/);
  assert.match(dryrun, /20261105230000_collaborator_manager_watch/);
  assert.match(dryrun, /safe-apply-migration\.sh/);
  assert.match(dryrun, /behaviour/);
  assert.deepEqual([...new Set([...dryrun.matchAll(/\d{14}_[a-z_]+\.sql/g)].map(match => match[0]))], ["20261105230000_collaborator_manager_watch.sql"]);
  for (const safety of ["disk_guard_require", "sha256sum", "127.0.0.1::5432", "leftover dry-run container exists", "trap cleanup EXIT", '[[ "$before" == "$after" ]]', "--postcondition-sql"]) assert.ok(dryrun.includes(safety), safety);
});
