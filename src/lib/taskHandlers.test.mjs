import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repositorySource = readFileSync(
  new URL("./taskRepository.ts", import.meta.url),
  "utf8",
);

test("task repository is server-only and uses the service-role client", () => {
  assert.match(repositorySource, /import "server-only"/);
  assert.match(repositorySource, /serverSupabase/);
  assert.doesNotMatch(repositorySource, /from ["']@\/lib\/supabase["']/);
  assert.doesNotMatch(repositorySource, /select\(["']\*["']/);
});

test("task repository calls only Phase-1 wrapper RPCs for mutations", () => {
  for (const rpc of [
    "api_create_task",
    "api_update_task",
    "api_claim_task_plan",
    "api_report_task_progress",
    "api_review_task_completion",
    "api_save_task_evaluation_checkpoint",
    "api_add_task_comment",
    "api_create_bulk_task_plan",
  ]) {
    assert.match(repositorySource, new RegExp(rpc));
  }
  assert.doesNotMatch(
    repositorySource,
    /\.rpc\(["'](?:claim_task_plan|report_task_progress|review_task_completion|save_task_evaluation_checkpoint|create_bulk_task_plan)["']/,
  );
});

test("task repository selects allowlisted fields and paginates", () => {
  assert.match(repositorySource, /TASK_LIST_FIELDS/);
  assert.match(repositorySource, /TASK_DETAIL_FIELDS/);
  assert.match(repositorySource, /\.range\(from, to\)/);
  assert.match(repositorySource, /task_assignees/);
  assert.match(repositorySource, /task_comments/);
  assert.match(repositorySource, /task_progress_logs/);
  assert.match(repositorySource, /task_evaluation_checkpoints/);
});
