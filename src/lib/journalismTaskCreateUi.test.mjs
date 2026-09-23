import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getJournalismDepartment } from "./journalismCreateUi.mjs";

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

test("Journalism assignment is locked to the Content department", () => {
  const shell = read("../components/TaskAssignShell.tsx");
  const route = read("../app/api/tasks/journalism/assign/route.ts");
  assert.match(shell, /getJournalismDepartment\(departments\)/);
  assert.match(shell, /journalismMode \? journalismDepartment\?\.id \?\? "" : departmentId/);
  assert.match(shell, /disabled=\{journalismMode\}/);
  assert.match(shell, /name=\{journalismMode \? undefined : "departmentId"\}/);
  assert.match(shell, /name="departmentId" type="hidden" value=\{journalismDepartment\?\.id \?\? ""\}/);
  assert.match(shell, /journalismMode \? departments\.filter\(\(department\) => department\.code === "editorial"\)/);
  assert.match(shell, /const watcherPeople = journalismMode \? scopedPeople : people/);
  assert.match(shell, /<CheckGroup name="watcherIds" people=\{watcherPeople/);
  assert.match(route, /staff_users[\s\S]*departments!staff_users_department_id_fkey\(code\)/);
  assert.match(route, /department\?\.code !== "editorial"/);
});

test("Journalism department resolution ignores every non-Content department", () => {
  const departments = [
    { id: "general", code: "general", name: "Phòng Tổng hợp" },
    { id: "editorial", code: "editorial", name: "Phòng Nội dung" },
    { id: "communications", code: "communications", name: "Phòng Truyền thông" },
  ];
  assert.deepEqual(getJournalismDepartment(departments), departments[1]);
  assert.equal(getJournalismDepartment(departments.filter((department) => department.code !== "editorial")), null);
});
