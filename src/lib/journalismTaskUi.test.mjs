import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("Task list renders Journalism summary only when Journalism data exists", () => {
  const shell = read("../components/TaskCenterShell.tsx");
  const summary = read("../components/JournalismSummary.tsx");
  assert.match(shell, /task\.journalism \? <JournalismSummary journalism=\{task\.journalism\}/);
  assert.match(summary, /Nghiệp vụ báo chí/);
  assert.match(summary, /journalismLabels.plannedPublicationDate/);
  assert.doesNotMatch(summary, /Chỉnh sửa thông tin|Lên lịch xuất bản|Đánh dấu đã xuất bản|Gỡ bài/);
});

test("Task detail exposes a read-only Journalism section with safe article links", () => {
  const shell = read("../components/TaskDetailShell.tsx");
  const section = read("../components/JournalismDetailSection.tsx");
  assert.match(shell, /task\.journalism \? <JournalismDetailSection journalism=\{task\.journalism\}/);
  assert.match(section, /aria-label="Nghiệp vụ báo chí"/);
  assert.match(section, /target="_blank"/);
  assert.match(section, /rel="noreferrer"/);
  assert.match(section, /break-all/);
  assert.doesNotMatch(section, /dangerouslySetInnerHTML/);
});

test("Task list loads active work kinds on the server and keeps filters URL-driven", () => {
  const page = read("../app/tasks/page.tsx");
  const repository = read("./taskRepository.ts");
  const shell = read("../components/TaskCenterShell.tsx");
  assert.match(repository, /from\("journalism_work_kinds"\)/);
  assert.match(repository, /\.eq\("is_active", true\)/);
  assert.match(page, /journalismWorkKinds=\{journalismWorkKinds\}/);
  for (const name of ["journalism", "workKind", "publicationStatus", "plannedFrom", "plannedTo"]) {
    assert.match(shell, new RegExp(`name="${name}"`));
  }
  assert.match(shell, /journalismFilter === "only"/);
  assert.doesNotMatch(shell, /tasks\.items\.filter\(/);
});

test("J4B-1 does not add Journalism mutation controls", () => {
  const files = [
    read("../components/JournalismSummary.tsx"),
    read("../components/JournalismDetailSection.tsx"),
  ].join("\n");
  assert.doesNotMatch(files, /fetch\(|PATCH|POST|journalism\.metadata\.update|journalism\.publication\.manage/);
});
