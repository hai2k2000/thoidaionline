import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./TaskDetailShell.tsx", import.meta.url), "utf8");

test("compact IA exposes four named task regions without hidden tab state", () => {
  for (const label of ["Tổng quan", "Trao đổi", "Lịch sử"]) assert.match(source, new RegExp(label));
  assert.match(source, /progress-reports/);
  assert.match(source, /<section aria-label="Tổng quan"/);
  assert.match(source, /<aside aria-label="Thông tin nhanh"/);
  assert.doesNotMatch(source, /role="tablist"|role="tabpanel"|window\.location\.hash|hashchange/);
});

test("desktop gets a main/sidebar hierarchy and mobile tabs wrap without viewport overflow", () => {
  assert.match(source, /lg:grid-cols-\[minmax\(0,1fr\)_390px\]/);
  assert.match(source, /xl:grid-cols-\[minmax\(0,1fr\)_430px\]/);
  assert.doesNotMatch(source, /whitespace-nowrap[^"]*overflow-x-auto|overflow-x-scroll/);
  assert.match(source, /aria-label="Thông tin nhanh"/);
});

test("primary and permission-gated workflow actions stay reachable", () => {
  for (const capability of ["review", "update", "comment", "attachment", "completeAssigned", "personalComplete", "personalCancel", "personalDeadline"]) {
    assert.match(source, new RegExp(`capabilities\\.${capability}`));
  }
  for (const route of ["progress-reports", "submit-completion", "review-completion", "cancel-assigned", "deadline-assigned", "comments", "attachments"]) {
    assert.match(source, new RegExp(route));
  }
  assert.match(source, /data-testid="task-completion-action"/);
  assert.match(source, /task-scoring-form/);
});

test("rare material is progressively disclosed without removing it", () => {
  assert.match(source, /<details/);
  assert.match(source, /Thay đổi hạn/);
  assert.match(source, /Trạng thái/);
  assert.match(source, /Đính kèm/);
});
