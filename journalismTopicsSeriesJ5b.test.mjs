import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migrationPath = new URL("./supabase/migrations/20260918130000_journalism_topics_series_j5_read.sql", import.meta.url);
const migration = () => fs.readFileSync(migrationPath, "utf8");
const contracts = () => fs.readFileSync(new URL("./src/lib/taskContracts.ts", import.meta.url), "utf8");
const repository = () => fs.readFileSync(new URL("./src/lib/taskRepository.ts", import.meta.url), "utf8");
const filters = () => fs.readFileSync(new URL("./src/lib/taskFilters.mjs", import.meta.url), "utf8");

test("J5B migration defines the four protected additive tables", () => {
  const sql = migration();
  for (const table of ["editorial_topics", "editorial_series", "editorial_topic_tasks", "editorial_series_items"]) {
    assert.match(sql, new RegExp(`create table public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"));
    assert.match(sql, new RegExp(`grant (all|select, insert, update, delete) on table public\\.${table} to service_role`, "i"));
  }
});

test("J5B migration protects names, cardinality, ordering, and department compatibility", () => {
  const sql = migration();
  assert.match(sql, /char_length\(name\) between 1 and 200/i);
  assert.match(sql, /char_length\(description\) <= 5000/i);
  assert.match(sql, /unique index .*editorial_topics.*lower\(btrim\(name\)\)/is);
  assert.match(sql, /unique index .*editorial_series.*lower\(btrim\(name\)\)/is);
  assert.match(sql, /unique \(series_id, position\)/i);
  assert.match(sql, /unique \(task_id\)/i);
  assert.match(sql, /global Series under department-owned Topic|department.*compatibility|series.*department/i);
  assert.match(sql, /trigger/i);
});

test("J5B migration rejects normal Task membership and keeps RBAC out", () => {
  const sql = migration();
  assert.match(sql, /journalism_task_details/i);
  assert.equal((sql.match(/task_id uuid not null references public\.journalism_task_details\(task_id\)/gi) ?? []).length, 2);
  assert.match(sql, /constraint trigger|trigger/i);
  assert.doesNotMatch(sql, /journalism\.structure\.(manage|assign)/i);
  assert.doesNotMatch(sql, /role_permission_grants|permission_catalog|grant_permission/i);
  assert.doesNotMatch(sql, /create or replace function public\..*mutation|rpc/i);
});

test("Task contracts expose nested Journalism Topic/Series values and new filters", () => {
  const source = contracts();
  assert.match(source, /topics\??:/);
  assert.match(source, /series\??:/);
  assert.match(source, /topicId\??: string \| null/);
  assert.match(source, /seriesId\??: string \| null/);
});

test("repository and parser implement server-side Topic/Series filtering", () => {
  const repo = repository();
  const source = filters();
  assert.match(repo, /editorial_topic_tasks/);
  assert.match(repo, /editorial_series_items/);
  assert.match(repo, /topicId/);
  assert.match(repo, /seriesId/);
  assert.match(source, /topicId/);
  assert.match(source, /seriesId/);
  assert.match(source, /topicId.*UUID|UUID.*topicId/is);
  assert.match(source, /seriesId.*UUID|UUID.*seriesId/is);
});

test("J5B read path does not add per-row Topic or Series queries", () => {
  const repo = repository();
  assert.doesNotMatch(repo, /for\s*\([^)]*data[^)]*\)[\s\S]{0,240}from\(["']editorial_(topic_tasks|series_items)/i);
  assert.match(repo, /topics/);
  assert.match(repo, /series/);
});
