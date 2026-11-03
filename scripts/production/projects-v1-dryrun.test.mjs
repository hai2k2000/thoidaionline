import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync("scripts/production/projects-v1-dryrun.sh", "utf8");
const migration = readFileSync("supabase/migrations/20261103160000_projects_v1.sql", "utf8");
const behaviour = readFileSync("supabase/tests/projects_v1_behaviour.sql", "utf8").toLowerCase();
const revert = readFileSync("scripts/production/projects-v1-revert.sql", "utf8").toLowerCase();
const post = readFileSync("scripts/production/projects-v1/post/20261103160000_projects_v1.sql", "utf8").toLowerCase();

test("dry-run has approval, disk, cleanup, backup, and stdin guards", () => {
  assert.match(script, /THOIDAI_PROJECTS_DRYRUN_APPROVED/);
  assert.match(script, /disk-guard\.sh/);
  assert.match(script, /latest verified daily backup/i);
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /main "\$@" <\/dev\/null/);
});

test("dry-run isolates disposable postgres and refuses leftovers", () => {
  assert.match(script, /127\.0\.0\.1::5432/);
  assert.match(script, /--memory 512m/);
  assert.match(script, /docker\s+ps\s+-a[\s\S]*?projects-v1-dryrun/);
  assert.doesNotMatch(script, /supabase_db_thoidai-work/);
  assert.doesNotMatch(script, /systemctl/);
});

test("restore tolerates dump compatibility errors but requires application tables and migration rows", () => {
  const restore = script.slice(script.indexOf("  step=restore"), script.indexOf("  apply_projects()"));
  assert.match(restore, /create schema if not exists supabase_migrations;[\s\S]*pg_restore/);
  assert.match(restore, /pg_restore --schema=public --schema=supabase_migrations/);
  assert.doesNotMatch(restore, /--clean|--if-exists|--exit-on-error/);
  assert.match(restore, /< "\$dump" >"\$work\/restore\.log" 2>&1 \|\| true/);
  for (const table of ["public.tasks", "public.staff_users", "public.departments", "supabase_migrations.schema_migrations"]) {
    assert.ok(restore.includes(`select count(*) from ${table}`));
  }
  assert.match(restore, /if ! restore_counts=\$\(psql -X -v ON_ERROR_STOP=1 -qAt/);
  assert.ok(restore.includes('[[ "$restore_counts" =~ ^[0-9]+\\|[0-9]+\\|[0-9]+\\|[1-9][0-9]*$ ]]'));
  assert.match(restore, /tail -n 20 "\$work\/restore\.log" \| grep 'ERROR' >&2 \|\| true\s+return 1/);
  assert.match(restore, /echo "\$restore_counts"\s+echo PROJECTS_RESTORE=PASS/);
});

test("dry-run applies behaviour, idempotency, revert, and reapply with strict psql", () => {
  assert.match(script, /safe-apply-migration\.sh/);
  assert.match(script, /psql -X -v ON_ERROR_STOP=1 -f/);
  assert.match(script, /20261103160000_projects_v1\.sql/);
  assert.match(script, /projects_v1_behaviour\.sql/);
  assert.match(script, /projects-v1-revert\.sql/);
  assert.match(script, /PROJECTS_DRYRUN_RESULT=PASS/);
  assert.match(script, /rm -rf -- "\$work"/);
});

test("postcondition checks project schema, RPCs, permission grants, and RLS", () => {
  for (const name of ["projects", "project_members", "project_id", "project.create"]) assert.match(post, new RegExp(name.replace(".", "\\.")));
  for (const name of ["api_create_project", "api_update_project", "api_set_project_member", "api_close_project", "api_assign_project_task"]) assert.match(post, new RegExp(name));
  assert.match(post, /select case when/);
  assert.match(post, /'pass'/);
});

test("revert removes project objects and ledger entry without touching unrelated functions", () => {
  assert.match(script, /delete\s+from\s+supabase_migrations\.schema_migrations\s+where\s+version\s*=\s*'20261103160000'/);
  assert.match(revert, /drop\s+table\s+public\.project_members/);
  assert.match(revert, /drop\s+table\s+public\.projects/);
  assert.doesNotMatch(revert, /drop\s+table\s+public\.tasks/);
});

test("migration and behaviour are transaction scoped", () => {
  assert.match(migration, /begin;/i);
  assert.match(migration, /commit;/i);
  assert.match(behaviour.trim(), /rollback;\s*$/);
});
