import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("task detail uses completion scoring and task deadline default", () => {
  const detail = read("../components/TaskDetailShell.tsx");
  assert.match(detail, /Chấm điểm hoàn thành/);
  assert.match(detail, /evaluationDeadline/);
  assert.match(detail, /task\.due_date\s*\?\?\s*today\(\)/);
  assert.doesNotMatch(detail, /save_task_evaluation_checkpoint|task\.legacy_evaluations\.map|\/evaluate/);
});

test("manual ChatGPT evaluation can be pasted without enabling an AI provider", () => {
  const detail = read("../components/TaskDetailShell.tsx");
  const factory = read("./taskHandlerFactory.ts");
  assert.doesNotMatch(detail, /Dán đánh giá từ ChatGPT/);
  assert.doesNotMatch(detail, /Nội dung đánh giá từ ChatGPT/);
  assert.doesNotMatch(detail, /disabled value="Chưa cấu hình AI"/);
  assert.match(detail, /evaluationDeadline/);
  assert.match(detail, /Lưu điểm và duyệt hoàn thành/);
  assert.match(factory, /service_unavailable[\s\S]*503/);
  assert.doesNotMatch(factory, /api\.openai\.com|anthropic|gemini/i);
});

test("progress report stays date plus status plus narrative with no percentage UX", () => {
  const detail = read("../components/TaskDetailShell.tsx");
  assert.match(detail, /progress-reports/);
  assert.match(detail, /reportStatus/);
  assert.match(detail, /progressText/);
  assert.doesNotMatch(detail, /progress_percent|type="range"|Tiến độ\s*%/i);
});

test("task detail defaults to one overview and collapses secondary information in the sidebar", () => {
  const detail = read("../components/TaskDetailShell.tsx");
  assert.doesNotMatch(detail, /role="tablist"|task-panel-progress|task-panel-history/);
  assert.match(detail, /aria-label="Tổng quan"/);
  assert.match(detail, /Đính kèm · Tệp/);
  assert.match(detail, /Lịch sử/);
});

test("completion action is rendered in the responsive top header", () => {
  const detail = read("../components/TaskDetailShell.tsx");
  const header = detail.indexOf("task-completion-action");
  const firstSection = detail.indexOf('<Section title="Thông tin chung"');
  assert.ok(header >= 0 && header < firstSection);
  assert.match(detail, /sm:flex-row/);
});

test("watcher comments remain server-authorized and other watcher mutations stay denied", () => {
  const authorization = read("./authorization.ts");
  const handlerTests = read("./taskHandlers.test.mjs");
  assert.match(authorization, /case "comment"[\s\S]*canTaskAction\(actor, task, "view"\)/);
  assert.match(handlerTests, /watcher may comment but may not report/);
});

test("qualitative evaluation migration is additive, audited and service-role only", () => {
  const sql = read("../../supabase/migrations/20260817165000_task_qualitative_evaluations.sql");
  assert.match(sql, /create table if not exists public\.task_qualitative_evaluations/i);
  assert.match(sql, /api_submit_task_qualitative_evaluation/i);
  assert.match(sql, /coalesce\(p_evaluation_deadline,v_task\.due_date,current_date\)/i);
  assert.match(sql, /audit_logs/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all[\s\S]*public,anon,authenticated/i);
  assert.match(sql, /grant execute[\s\S]*service_role/i);
  assert.match(sql, /if not coalesce\(v_allowed,false\)/i);
  assert.doesNotMatch(sql, /drop\s+(?:table|column)|truncate|delete\s+from|alter\s+table\s+public\.task_evaluation_checkpoints/i);
});

test("qualitative evaluation provenance is stored and leader authorization is explicit", () => {
  const migration = read("../../supabase/migrations/20260818120000_leader_task_qualitative_evaluation.sql");
  assert.match(migration, /evaluation_source/);
  assert.match(migration, /chatgpt.*leader|leader.*chatgpt/i);
  assert.match(migration, /departments[\s\S]*manager_id/);
  assert.match(migration, /can_evaluate_step2/);
  const authorization = read("./authorization.ts");
  assert.match(authorization, /leader_evaluate/);
});
