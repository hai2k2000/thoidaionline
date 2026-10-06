import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("personal summary route enforces permission and actor-owned query", () => {
  const source = readFileSync(new URL("./quickReportPersonalSummaryService.ts", import.meta.url), "utf8");
  const repository = readFileSync(new URL("./quickReportPersonalSummaryRepository.ts", import.meta.url), "utf8");
  assert.match(source, /task\.quick_report\.create/);
  assert.match(repository, /owner_id/);
  assert.match(repository, /workflow_type.*REPORT_ONLY/);
  assert.doesNotMatch(source, /user_id\s*=/);
});

test("personal summary Word export reuses the summary filter route", () => {
  const source = readFileSync(new URL("./quickReportPersonalSummaryDocx.ts", import.meta.url), "utf8");
  assert.match(source, /Packer\.toBuffer/);
  assert.match(source, /BÁO CÁO CÔNG VIỆC PHÁT SINH/);
});

test("Word export requests the bounded full filtered dataset", () => {
  const source = readFileSync(new URL("../app/api/tasks/quick-report/summary/docx/route.ts", import.meta.url), "utf8");
  assert.match(source, /pageSizeLimit/);
  assert.match(source, /MAX_PERSONAL_QUICK_REPORT_ROWS/);
});