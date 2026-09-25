import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("general assignment removes the Journalism tab and canonicalizes the legacy query", () => {
  const page = read("../app/tasks/assign/page.tsx");
  const shell = read("../components/TaskAssignShell.tsx");
  assert.match(page, /rawParams\.kind === "journalism"/);
  assert.match(page, /\/journalism\/tasks\/new/);
  assert.match(page, /journalismMode=\{false\}/);
  assert.match(shell, /Công việc thường/);
  assert.doesNotMatch(shell, /href="\/tasks\/assign\?kind=journalism"/);
  assert.doesNotMatch(shell, />Công việc nghiệp vụ báo chí<\/Link>/);
});

test("Journalism create UI uses active server options and excludes recurrence/publication mutation fields", () => {
  const page = read("../app/journalism/tasks/new/page.tsx");
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
  const page = read("../app/journalism/tasks/new/page.tsx");
  const shell = read("../components/TaskAssignShell.tsx");
  assert.match(page, /journalismDepartment/);
  assert.match(shell, /Phòng Nội dung/);
  assert.doesNotMatch(shell, /journalismMode \? null : <select name="departmentId"/);
});

test("canonical Journalism task route reuses the Task Center and forces Journalism-only mode", () => {
  const page = read("../app/journalism/tasks/page.tsx");
  assert.match(page, /TasksPage/);
  assert.match(page, /forceJournalism/);
  const navigation = read("../components/phase2Navigation.ts");
  assert.match(navigation, /journalism-tasks.*href: "\/journalism\/tasks"/s);
});

test("editorial reporters use a self-only Journalism creation mode", () => {
  const page = read("../app/journalism/tasks/new/page.tsx");
  const shell = read("../components/TaskAssignShell.tsx");
  assert.match(page, /journalismSelfCreate/);
  assert.match(shell, /journalismSelfCreate/);
  assert.match(shell, /assigneeId.*user/);
  assert.match(shell, /payload\.selfRegister = true/);
  assert.match(shell, /Tôi \(tự đăng ký\)/);
  assert.match(shell, /!journalismSelfCreate \? <Field label="Người theo dõi bổ sung"/);
});

test("Journalism self-registration uses the dedicated approval RPC", () => {
  const route = read("../app/api/tasks/journalism/assign/route.ts");
  const migration = read("../../supabase/migrations/20260925100000_journalism_self_registration.sql");
  assert.match(route, /api_register_journalism_task_v1/);
  assert.doesNotMatch(route, /api_create_personal_task_v2/);
  assert.match(migration, /api_register_journalism_task_v1/);
  assert.match(migration, /approval_required/);
  assert.match(migration, /'waiting'/);
  assert.match(migration, /self_registered/);
  assert.match(migration, /department.*editorial|editorial.*department/s);
});

test("Journalism creation lives under the Journalism section and reuses the existing backend", () => {
  const page = read("../app/journalism/tasks/new/page.tsx");
  const shell = read("../components/TaskAssignShell.tsx");
  const center = read("../components/TaskCenterShell.tsx");
  assert.match(page, /canUseJournalism/);
  assert.match(page, /canAccessTaskAssignment/);
  assert.match(page, /journalismMode=\{true\}/);
  assert.match(shell, /currentPath=\{journalismMode \? "\/journalism\/tasks\/new"/);
  assert.match(shell, /journalismMode \? "\/api\/tasks\/journalism\/assign"/);
  assert.match(center, /\+ Tạo công việc nghiệp vụ báo chí/);
  assert.match(center, /journalism\/tasks\/new/);
});
