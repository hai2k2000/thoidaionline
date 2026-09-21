import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  localDateTime,
  manualPublicationError,
  serializeVietnamPublicationTime,
  validatePublicationNote,
  validatePublishedTitle,
  validateReportedPublicationUrl,
} from "./journalismManualPublicationUi.mjs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("manual publication URL validation is provider-independent and rejects unsafe schemes", () => {
  assert.deepEqual(validateReportedPublicationUrl(" https://example.com/story "), { ok: true, value: "https://example.com/story" });
  assert.equal(validateReportedPublicationUrl("http://example.com").ok, true);
  for (const value of ["/story", "ftp://example.com", "javascript:alert(1)", "data:text/plain,x", "https://user:pass@example.com"]) {
    assert.equal(validateReportedPublicationUrl(value).ok, false);
  }
});

test("manual publication fields validate bounded metadata and Vietnam-local time", () => {
  assert.deepEqual(serializeVietnamPublicationTime("2026-09-20", "09:30"), { ok: true, value: "2026-09-20T02:30:00.000Z" });
  assert.equal(serializeVietnamPublicationTime("2026-02-30", "09:30").ok, false);
  assert.deepEqual(localDateTime("2026-09-20T02:30:00.000Z"), { date: "2026-09-20", time: "09:30" });
  assert.deepEqual(validatePublishedTitle("  Bài đã đăng  "), { ok: true, value: "Bài đã đăng" });
  assert.deepEqual(validatePublishedTitle(""), { ok: true, value: null });
  assert.equal(validatePublishedTitle("x".repeat(501)).ok, false);
  assert.equal(validatePublicationNote("x".repeat(5001)).ok, false);
});

test("manual publication error handling is safe and refreshes stale dialogs", () => {
  assert.deepEqual(manualPublicationError(409, "conflict"), { refresh: true, close: true, message: "Thông tin xuất bản đã thay đổi. Dữ liệu mới nhất đã được tải lại." });
  assert.equal(manualPublicationError(403, "forbidden").refresh, true);
  assert.equal(manualPublicationError(400, "invalid_request").close, false);
});

test("manual report route derives actor server-side and stays on the existing task permission", () => {
  const route = read("../app/api/tasks/[id]/journalism/publication-report/route.ts");
  assert.match(route, /requireMutationActor/);
  assert.match(route, /journalism\.publication\.manage/);
  assert.match(route, /p_actor_id: guard\.actor\.id/);
  assert.match(route, /publicationUrl|publishedTitle|publishedAt|note/);
  assert.doesNotMatch(route, /reportedBy|cms_content_id|mastercms|provider_status/);
});

test("manual report schema is separate from CMS and has one active report per Task", () => {
  const migration = read("../../supabase/migrations/20260919110000_journalism_manual_publication_reporting.sql");
  assert.match(migration, /create table public\.journalism_publication_reports/);
  assert.match(migration, /unique \(task_id\)/);
  assert.match(migration, /publication_url/);
  assert.match(migration, /reported_by uuid not null/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /grant .* to service_role/);
  assert.match(migration, /api_assert_journalism_access/);
  assert.match(migration, /p_actor_id/);
  assert.doesNotMatch(migration, /cms_content_id|mastercms|provider_status|provider_revision|provider_etag/);
});

test("Task detail renders manual reporting without changing existing Journalism state controls", () => {
  const shell = read("../components/TaskDetailShell.tsx");
  const component = read("../components/JournalismManualPublicationReport.tsx");
  assert.match(shell, /JournalismManualPublicationReport/);
  assert.match(shell, /task\.journalism\.publication_report/);
  assert.match(component, /Chưa ghi nhận xuất bản/);
  assert.match(component, /Ghi nhận xuất bản/);
  assert.match(component, /Cập nhật thông tin xuất bản/);
  assert.doesNotMatch(component, /MasterCMS|CMS status|CMS ID|Publish to CMS|Đồng bộ CMS/);
  assert.doesNotMatch(component, /Unpublish article|Gỡ bài/);
});

test("manual report UI never accepts a client reporter identity or deletes a report", () => {
  const component = read("../components/JournalismManualPublicationReport.tsx");
  assert.match(component, /expectedUpdatedAt/);
  assert.doesNotMatch(component, /reportedBy|reported_by|DELETE|delete\(/);
  assert.doesNotMatch(component, /createClient|serverSupabase|\.rpc\(/);
});
