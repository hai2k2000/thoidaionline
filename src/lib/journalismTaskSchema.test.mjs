import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationPath = resolve(
  "/opt/worktrees/journalism-tasks-j2-schema-read/supabase/migrations/20260917190000_journalism_tasks_j2_schema.sql",
);

test("J2 migration defines the approved journalism master and detail tables", () => {
  const sql = readFileSync(migrationPath, "utf8");

  for (const table of ["journalism_work_kinds", "journalism_task_details"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, "i"));
  }
  for (const column of [
    "id uuid",
    "code text",
    "name text",
    "description text",
    "is_active boolean",
    "sort_order integer",
    "created_at timestamptz",
    "updated_at timestamptz",
    "task_id uuid",
    "work_kind_id uuid",
    "publication_status text",
    "planned_publication_at timestamptz",
    "published_at timestamptz",
    "location text",
    "article_url text",
    "editorial_notes text",
  ]) assert.match(sql, new RegExp(column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  for (const forbidden of [
    "task_domain",
    "task_kind",
    "content_format",
    "source_contact_notes",
    "external_system",
    "external_content_id",
    "topic_id",
    "series_id",
    "related_task_id",
    "api_assign_journalism_task",
  ]) assert.doesNotMatch(sql, new RegExp(forbidden, "i"));
});

test("J2 migration seeds the approved controlled work-kind catalog", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const rows = [
    [10, "news", "Tin"],
    [20, "article", "Bài viết"],
    [30, "interview", "Phỏng vấn"],
    [40, "reportage", "Phóng sự"],
    [50, "photo", "Ảnh"],
    [60, "video", "Video"],
    [70, "event_coverage", "Tác nghiệp sự kiện"],
    [80, "editing", "Biên tập"],
    [90, "translation", "Biên dịch"],
    [100, "other", "Khác"],
  ];
  for (const [sortOrder, code, name] of rows) {
    assert.match(sql, new RegExp(`\\('${code}',\\s*'${name}',\\s*${sortOrder}\\)`, "u"));
  }
  assert.match(sql, /on conflict \(code\) do update/i);
  assert.match(sql, /unique\s*\(code\)/i);
});

test("J2 migration enforces publication invariants and field limits", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /publication_status\s+text\s+not null\s+default\s+'not_published'/i);
  assert.match(sql, /publication_status\s+in\s*\('not_published',\s*'scheduled',\s*'published',\s*'withdrawn'\)/i);
  assert.match(sql, /scheduled[\s\S]*planned_publication_at\s+is not null[\s\S]*published_at\s+is null/i);
  assert.match(sql, /published[\s\S]*published_at\s+is not null/i);
  assert.match(sql, /withdrawn[\s\S]*published_at\s+is not null/i);
  assert.match(sql, /not_published[\s\S]*published_at\s+is null/i);
  assert.match(sql, /char_length\(code\)\s+between\s+1\s+and\s+64/i);
  assert.match(sql, /char_length\(name\)\s+between\s+1\s+and\s+200/i);
  assert.match(sql, /char_length\(description\)\s*<=\s*2000/i);
  assert.match(sql, /char_length\(location\)\s*<=\s*500/i);
  assert.match(sql, /char_length\(article_url\)\s*<=\s*2048/i);
  assert.match(sql, /char_length\(editorial_notes\)\s*<=\s*10000/i);
  assert.match(sql, /article_url\s+is null[\s\S]*publication_status\s+in\s*\('published',\s*'withdrawn'\)/i);
});

test("J2 migration protects references and uses the hardened access model", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /primary key[\s\S]*references public\.tasks\(id\)[\s\S]*on delete cascade/i);
  assert.match(sql, /references public\.journalism_work_kinds\(id\)[\s\S]*on delete restrict/i);
  assert.match(sql, /create index[^;]*journalism_task_details[^;]*work_kind_id/i);
  assert.match(sql, /create index[^;]*journalism_task_details[^;]*publication_status/i);
  assert.match(sql, /create index[^;]*journalism_task_details[^;]*planned_publication_at/i);
  assert.match(sql, /alter table public\.journalism_work_kinds enable row level security/i);
  assert.match(sql, /alter table public\.journalism_task_details enable row level security/i);
  assert.match(sql, /revoke all on table public\.journalism_work_kinds from public, anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.journalism_task_details from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.journalism_work_kinds to service_role/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.journalism_task_details to service_role/i);
});
