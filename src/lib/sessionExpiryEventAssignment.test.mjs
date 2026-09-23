import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("expired sessions stop notification polling and redirect cleanly", () => {
  const bell = read("../components/NotificationBell.tsx");
  const auth = read("./auth.tsx");
  assert.match(bell, /response\?\.status === 401/);
  assert.match(bell, /sessionExpired/);
  assert.match(bell, /\/login\?reason=session_expired/);
  assert.match(auth, /response\?\.status === 401/);
  assert.match(auth, /\/login\?reason=session_expired/);
});

test("leadership task assignment screen exposes Event Assignment", () => {
  const page = read("../app/tasks/assign/page.tsx");
  const shell = read("../components/TaskAssignShell.tsx");
  for (const role of ["admin", "tong_bien_tap", "pho_tong_bien_tap"]) assert.match(page, new RegExp(role));
  assert.match(page, /is_department_manager/);
  assert.match(shell, /canManageEventAssignment/);
  assert.doesNotMatch(shell, /Tạo sự kiện \/ Phân công sự kiện/);
  assert.match(shell, /Phân công sự kiện/);
  assert.match(shell, /work-schedule/);
});
