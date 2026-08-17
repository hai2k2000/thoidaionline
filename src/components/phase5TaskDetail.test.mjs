import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("Phase 5 task detail is server-scoped and ordered by canonical sections", () => {
  const page = read("../app/tasks/[id]/page.tsx");
  const shell = read("../components/TaskDetailShell.tsx");
  assert.match(page, /getSessionUser/);
  assert.match(page, /taskRepository\.detail/);
  assert.match(page, /canTaskAction/);
  assert.doesNotMatch(page, /"use client"/);
  assert.doesNotMatch(page, /@\/lib\/supabase/);
  const sections = ["Thông tin chung", "Nội dung công việc", "Tiêu chí đánh giá", "Báo cáo tiến triển & vướng mắc", "Trao đổi", "Đánh giá cũ", "Đính kèm", "Lịch sử"];
  let offset = -1;
  for (const section of sections) {
    const next = shell.indexOf(section);
    assert.ok(next > offset, `${section} must follow the canonical detail order`);
    offset = next;
  }
});

test("structured progress and workflow controls never use progress percent", () => {
  const shell = read("../components/TaskDetailShell.tsx");
  assert.match(shell, /reportedOn/);
  assert.match(shell, /reportStatus/);
  assert.match(shell, /progressText/);
  assert.match(shell, /blockers/);
  assert.doesNotMatch(shell, /progress_percent|newProgress|type="range"/);
  assert.match(shell, /pending_review/);
  assert.match(shell, /Trả lại/);
  assert.match(shell, /Hủy/);
});

test("Phase 5 routes are thin same-origin task handlers", () => {
  for (const path of [
    "../app/api/tasks/[id]/progress-reports/route.ts",
    "../app/api/tasks/[id]/submit-completion/route.ts",
    "../app/api/tasks/[id]/review-completion/route.ts",
    "../app/api/tasks/[id]/cancel-assigned/route.ts",
    "../app/api/tasks/[id]/deadline-assigned/route.ts",
    "../app/api/tasks/[id]/attachments/route.ts",
    "../app/api/tasks/[id]/attachments/[attachmentId]/route.ts",
  ]) {
    const route = read(path);
    assert.match(route, /taskHandlers/);
    assert.doesNotMatch(route, /@\/lib\/supabase/);
  }
});

test("private attachments use server storage, rollback metadata failures and short signed URLs", () => {
  const wiring = read("../lib/taskHandlers.ts");
  const factory = read("../lib/taskHandlerFactory.ts");
  const repository = read("../lib/taskRepository.ts");
  assert.match(wiring, /serverSupabase\.storage\.from\("task-private"\)/);
  assert.match(wiring, /createSignedUrl\(path, 60\)/);
  assert.doesNotMatch(wiring, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(factory, /await deps\.removePrivateAttachment\(storagePath\)/);
  assert.match(repository, /\.eq\("task_id", taskId\)\.eq\("id", attachmentId\)\.maybeSingle\(\)/);
});

test("Phase 5 migration is additive, audited and creates a private bucket", () => {
  const migration = read("../../supabase/migrations/20260817070000_phase5_task_detail_workflow.sql");
  assert.doesNotMatch(migration, /\b(?:drop|truncate|delete\s+from)\b/i);
  assert.match(migration, /task_progress_reports/);
  assert.match(migration, /task_status_events/);
  assert.match(migration, /task_deadline_history/);
  assert.match(migration, /task_attachments/);
  assert.match(migration, /audit_logs/);
  assert.match(migration, /'task-private'/);
  assert.match(migration, /public=false/);
  assert.match(migration, /from public,anon,authenticated/);
});
