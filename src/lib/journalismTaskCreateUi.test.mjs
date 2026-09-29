import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("create mode exposes explicit normal and Journalism choices", () => {
  const page = read("../app/tasks/assign/page.tsx");
  const shell = read("../components/TaskAssignShell.tsx");
  assert.match(page, /rawParams\.kind === "journalism"/);
  assert.match(shell, /Công việc thường/);
  assert.match(shell, /Công việc nghiệp vụ báo chí/);
  assert.match(shell, /kind=journalism/);
});

test("Journalism create UI uses active server options and excludes recurrence/publication mutation fields", () => {
  const page = read("../app/tasks/assign/page.tsx");
  const shell = read("../components/TaskAssignShell.tsx");
  assert.match(page, /listJournalismWorkKinds/);
  assert.match(page, /filter\(\(kind\) => kind\.is_active\)/);
  assert.match(shell, /name="workKindId"/);
  assert.match(shell, /Trạng thái ban đầu: Chưa xuất bản/);
  assert.match(shell, /name="plannedPublicationDate"/);
  assert.match(shell, /name="plannedPublicationTime"/);
  assert.match(shell, /name="location" maxLength=\{500\}/);
  assert.match(shell, /name="editorialNotes" maxLength=\{10000\}/);
  assert.doesNotMatch(shell, /name="publicationStatus"|name="publishedAt"|name="articleUrl"/);
  assert.match(shell, /journalismMode \? "\/api\/tasks\/journalism\/assign"/);
});

test("Journalism mode never sends recurrence configuration", () => {
  const shell = read("../components/TaskAssignShell.tsx");
  assert.match(shell, /journalismMode \? \{\} : \{ recurrenceFrequency/);
  assert.match(shell, /const payload = journalismMode[\s\S]*buildJournalismCreatePayload/);
  assert.match(shell, /submittingRef/);
});

test("Journalism mode fixes the department to Phòng Nội dung", () => {
  const page = read("../app/tasks/assign/page.tsx");
  const shell = read("../components/TaskAssignShell.tsx");
  assert.match(page, /journalismDepartment/);
  assert.match(shell, /Phòng Nội dung/);
  assert.doesNotMatch(shell, /journalismMode \? null : <select name="departmentId"/);
});
