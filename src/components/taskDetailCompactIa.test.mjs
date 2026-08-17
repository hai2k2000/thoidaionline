import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./TaskDetailShell.tsx", import.meta.url), "utf8");

test("compact IA exposes four accessible hash-addressable task views", () => {
  for (const [id, label] of [
    ["overview", "Tổng quan"],
    ["progress", "Tiến độ"],
    ["comments", "Bình luận"],
    ["history", "Lịch sử"],
  ]) {
    assert.match(source, new RegExp(`id: ["']${id}["'][\\s\\S]*label: ["']${label}["']`));
    assert.match(source, new RegExp(`task-panel-${id}`));
  }
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-selected=/);
  assert.match(source, /aria-controls=/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /window\.location\.hash/);
  assert.match(source, /hashchange/);
  assert.match(source, /ArrowLeft|ArrowRight/);
  assert.doesNotMatch(source, /id: ["']evaluation["'], label:/);
  assert.match(source, /hash === "evaluation"/);
});

test("desktop gets a main/sidebar hierarchy and mobile tabs wrap without viewport overflow", () => {
  assert.match(source, /lg:grid-cols-\[minmax\(0,1fr\)_300px\]/);
  assert.match(source, /grid-cols-2[^"]*sm:grid-cols-4/);
  assert.doesNotMatch(source, /whitespace-nowrap[^"]*overflow-x-auto|overflow-x-scroll/);
  assert.match(source, /aria-label="Thông tin nhanh"/);
});

test("primary and permission-gated workflow actions stay reachable", () => {
  for (const capability of ["report", "review", "update", "comment", "attachment", "evaluate", "personalComplete", "personalCancel", "personalDeadline"]) {
    assert.match(source, new RegExp(`capabilities\\.${capability}`));
  }
  for (const route of ["progress-reports", "submit-completion", "review-completion", "cancel-assigned", "deadline-assigned", "comments", "attachments", "evaluations"]) {
    assert.match(source, new RegExp(route));
  }
  assert.match(source, /data-testid="task-completion-action"/);
  assert.match(source, /Vướng mắc \(bắt buộc khi bị chặn\)/);
});

test("rare material is progressively disclosed without removing it", () => {
  assert.match(source, /<details/);
  assert.match(source, /Đánh giá bằng AI/);
  assert.match(source, /Đánh giá trước đây/);
  assert.match(source, /Tiến độ cũ/);
  assert.match(source, /Đính kèm/);
});
