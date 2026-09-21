import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migrationPath = "supabase/migrations/20260918140000_journalism_topics_series_j5_management.sql";
const structureAuthPath = "src/lib/journalismStructureAuthorization.ts";
const topicRoute = "src/app/api/journalism/topics/route.ts";
const topicItemRoute = "src/app/api/journalism/topics/[topicId]/route.ts";
const topicArchiveRoute = "src/app/api/journalism/topics/[topicId]/archive/route.ts";
const seriesRoute = "src/app/api/journalism/series/route.ts";
const seriesItemRoute = "src/app/api/journalism/series/[seriesId]/route.ts";
const seriesArchiveRoute = "src/app/api/journalism/series/[seriesId]/archive/route.ts";

test("J5C migration declares exact structure permissions and server-only atomic RPCs", () => {
  assert.equal(fs.existsSync(migrationPath), true);
  const sql = fs.readFileSync(migrationPath, "utf8");
  for (const code of ["journalism.structure.manage", "journalism.structure.assign"]) assert.match(sql, new RegExp(code.replaceAll(".", "\\.")));
  for (const fn of [
    "api_create_editorial_topic_v1", "api_update_editorial_topic_v1", "api_archive_editorial_topic_v1",
    "api_create_editorial_series_v1", "api_update_editorial_series_v1", "api_archive_editorial_series_v1",
  ]) assert.match(sql, new RegExp("create or replace function public\\." + fn));
  assert.match(sql, /revoke all on function public\.%s from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.%s to service_role/);
  assert.match(sql, /if not p_update_name and not p_update_description and not p_update_topic then return v_row; end if;/);
  assert.doesNotMatch(sql, /reorder|append|detach|association/i);
});

test("J5C structure authorization is scope-based and not task-shaped", () => {
  assert.equal(fs.existsSync(structureAuthPath), true);
  const source = fs.readFileSync(structureAuthPath, "utf8");
  assert.match(source, /journalism\.structure\.manage/);
  assert.match(source, /departmentId/);
  assert.doesNotMatch(source, /RbacTaskResource|kind:\s*["']task/);
});

test("J5C exposes only server mutation routes with session guards and allowlists", () => {
  for (const path of [topicRoute, topicItemRoute, topicArchiveRoute, seriesRoute, seriesItemRoute, seriesArchiveRoute]) {
    assert.equal(fs.existsSync(path), true, path);
    const source = fs.readFileSync(path, "utf8") + fs.readFileSync("src/lib/journalismStructureHandlers.ts", "utf8");
    assert.match(source, /requireMutationActor/);
    assert.match(source, /rpc\(/);
    assert.doesNotMatch(source, /actorId|role|scope|permission/);
  }
  assert.match(fs.readFileSync("src/lib/journalismStructureHandlers.ts", "utf8"), /departmentId/);
  assert.match(fs.readFileSync("src/lib/journalismStructureHandlers.ts", "utf8"), /topicId/);
  const handlers = fs.readFileSync("src/lib/journalismStructureHandlers.ts", "utf8");
  assert.match(handlers, /departmentId.*invalid|invalid.*departmentId/s);
});

test("J5C does not add association or reorder API routes", () => {
  const files = fs.existsSync("src/app/api/journalism")
    ? fs.readdirSync("src/app/api/journalism", { recursive: true }).join("\n")
    : "";
  assert.doesNotMatch(files, /associate|append|detach|reorder/i);
});
