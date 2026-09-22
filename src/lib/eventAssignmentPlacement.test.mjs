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
  assert.match(panel, /Tạo sự kiện \/ Phân công sự kiện/);
});

test("work schedule keeps event assignment out of its create flow", () => {
  const shell = read("../components/WorkSchedulePageShell.tsx");
  assert.doesNotMatch(shell, /<EventAssignmentPanel/);
});
