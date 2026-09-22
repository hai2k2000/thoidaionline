import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildPublicationRequest,
  publicationActions,
  publicationError,
  validateArticleUrl,
  validateSchedule,
  validateWithdrawalReason,
} from "./journalismPublicationUi.mjs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("publication state exposes only valid next actions", () => {
  assert.deepEqual(publicationActions("not_published"), ["schedule", "publish"]);
  assert.deepEqual(publicationActions("scheduled"), ["cancel_schedule", "publish"]);
  assert.deepEqual(publicationActions("published"), ["withdraw"]);
  assert.deepEqual(publicationActions("withdrawn"), []);
  assert.deepEqual(publicationActions("unexpected"), []);
});

test("publication payloads contain only transition fields", () => {
  assert.deepEqual(buildPublicationRequest("schedule", { plannedPublicationAt: "2026-09-20T09:30:00+07:00" }), { status: "scheduled", plannedPublicationAt: "2026-09-20T09:30:00+07:00" });
  assert.deepEqual(buildPublicationRequest("cancel_schedule", {}), { status: "not_published" });
  assert.deepEqual(buildPublicationRequest("publish", { articleUrl: " https://example.com/story " }), { status: "published", articleUrl: "https://example.com/story" });
  assert.deepEqual(buildPublicationRequest("withdraw", { reason: "  Sai thông tin  " }), { status: "withdrawn", reason: "Sai thông tin" });
});

test("schedule requires a complete deterministic Vietnam-local timestamp", () => {
  assert.equal(validateSchedule("", "09:30").ok, false);
  assert.equal(validateSchedule("2026-09-20", "").ok, false);
  assert.equal(validateSchedule("2026-02-30", "09:30").ok, false);
  assert.equal(validateSchedule("2026-09-23", "01:30", new Date("2026-09-22T00:00:00Z")).ok, true);
  assert.deepEqual(validateSchedule("2026-09-20", "09:30", new Date("2026-09-19T00:00:00Z")), { ok: true, value: "2026-09-20T09:30:00+07:00" });
});

test("article URL accepts only bounded absolute http/https without userinfo", () => {
  assert.deepEqual(validateArticleUrl(" https://example.com/story "), { ok: true, value: "https://example.com/story" });
  assert.equal(validateArticleUrl("http://example.com").ok, true);
  assert.equal(validateArticleUrl(` ${"https://example.com/"}${"x".repeat(2000)} `).ok, true);
  for (const value of ["/story", "ftp://example.com", "javascript:alert(1)", "https://user:pass@example.com", `https://example.com/${"x".repeat(2049)}`]) {
    assert.equal(validateArticleUrl(value).ok, false);
  }
});

test("withdrawal reason trims, accepts 2000 Unicode characters, and rejects invalid values", () => {
  assert.equal(validateWithdrawalReason("   ").ok, false);
  assert.equal(validateWithdrawalReason("đ".repeat(2000)).ok, true);
  assert.equal(validateWithdrawalReason("đ".repeat(2001)).ok, false);
});

test("conflict, forbidden, not-found, and unexpected responses map safely", () => {
  assert.deepEqual(publicationError(409, "publication_state_conflict"), { refresh: true, close: true, message: "Trạng thái xuất bản đã thay đổi. Dữ liệu mới nhất đã được tải lại." });
  assert.equal(publicationError(403, "forbidden").message, "Bạn không có quyền thay đổi trạng thái xuất bản của công việc này.");
  assert.equal(publicationError(404, "not_found").message, "Không tìm thấy thông tin nghiệp vụ báo chí.");
  assert.equal(publicationError(400, "invalid_request", "schedule").message, "Cần nhập thời gian dự kiến xuất bản để lên lịch.");
  assert.equal(publicationError(500, "internal").message, "Không thể hoàn tất thao tác xuất bản. Vui lòng thử lại.");
});

test("publication UI uses independent permission, correct endpoint, accessible dialogs, and no direct backend client", () => {
  const page = read("../app/tasks/[id]/page.tsx");
  const shell = read("../components/TaskDetailShell.tsx");
  const controls = read("../components/JournalismPublicationControls.tsx");
  assert.match(page, /journalism\.publication\.manage/);
  assert.match(shell, /journalismPublicationManage/);
  assert.match(shell, /capabilities\.journalismMetadataUpdate \? <JournalismMetadataEditor/);
  assert.match(shell, /capabilities\.journalismPublicationManage \? <JournalismPublicationControls/);
  assert.match(controls, /\/api\/tasks\/\$\{taskId\}\/journalism\/publication/);
  assert.match(controls, /role="dialog"/);
  assert.match(controls, /aria-modal="true"/);
  assert.match(controls, /aria-describedby/);
  assert.doesNotMatch(controls, /createClient|serverSupabase|\.rpc\(|roleCode|tong_bien_tap|admin/);
  assert.doesNotMatch(controls, /expectedUpdatedAt|publishedAt|actorId|etag|version/);
});

test("409 handling performs one request, closes stale dialog, and refreshes without retry", () => {
  const controls = read("../components/JournalismPublicationControls.tsx");
  assert.equal((controls.match(/await fetch\(/g) ?? []).length, 1);
  assert.match(controls, /publicationError\(response\.status, code, action\)/);
  assert.match(controls, /if \(mapped\.close\) dialogRef\.current\?\.close\(\)/);
  assert.match(controls, /if \(mapped\.refresh\) router\.refresh\(\)/);
  assert.match(controls, /if \(!action \|\| busyRef\.current\) return/);
  assert.doesNotMatch(controls, /retry|setTimeout\(|while \(/);
});

test("published URL remains read-only and metadata editor stays URL-free", () => {
  const detail = read("../components/JournalismDetailSection.tsx");
  const metadata = read("../components/JournalismMetadataEditor.tsx");
  const controls = read("../components/JournalismPublicationControls.tsx");
  assert.match(detail, /target="_blank"/);
  assert.match(detail, /rel="noreferrer"/);
  assert.doesNotMatch(metadata, /articleUrl|URL bài đã xuất bản/);
  assert.doesNotMatch(controls, /Sửa URL|Đổi đường dẫn|Chỉnh URL/);
  assert.match(controls, /safeJournalismArticleUrl/);
  assert.match(controls, /URL bài đã xuất bản/);
  assert.match(controls, /type="text" inputMode="url"/);
  assert.doesNotMatch(controls, /type="url"/);
});
