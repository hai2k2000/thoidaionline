import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("task assignment page grants event managers access without task assignment permission", () => {
  const page = read("../app/tasks/assign/page.tsx");
  assert.match(page, /is_department_manager/);
  assert.match(page, /eventPeople/);
});

test("task assignment shell mounts event assignment beside the heading", () => {
  const shell = read("../components/TaskAssignShell.tsx");
  const panel = read("../components/EventAssignmentPanel.tsx");
  assert.match(shell, /EventAssignmentPanel/);
  assert.match(shell, /compact/);
  assert.match(panel, /Phân công sự kiện/);
  assert.doesNotMatch(panel, /Tạo sự kiện \/ Phân công sự kiện/);
});

test("event assignment action shares the work-type navigation row", () => {
  const shell = read("../components/TaskAssignShell.tsx");
  const navStart = shell.indexOf('<nav aria-label="Loại công việc cần tạo"');
  const navEnd = shell.indexOf("</nav>", navStart);
  const navigation = shell.slice(navStart, navEnd);
  assert.notEqual(navStart, -1);
  assert.match(navigation, /Công việc thường/);
  assert.match(navigation, /Công việc nghiệp vụ báo chí/);
  assert.match(navigation, /EventAssignmentPanel/);
});

test("Journalism mode fixes assignment to the editorial department", () => {
  const shell = read("../components/TaskAssignShell.tsx");
  assert.match(shell, /departments\.find\(\(department\) => department\.code === "editorial"\)/);
  assert.match(shell, /useState\(journalismMode \? editorialDepartment\?\.id \?\? "" : ""\)/);
  assert.match(shell, /Phòng Nội dung/);
  assert.match(shell, /name="departmentId" type="hidden"/);
});

test("work schedule keeps event assignment out of its create flow", () => {
  const shell = read("../components/WorkSchedulePageShell.tsx");
  assert.doesNotMatch(shell, /<EventAssignmentPanel/);
});
