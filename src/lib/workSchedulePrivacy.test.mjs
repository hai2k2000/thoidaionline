import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const route = read("../app/api/work-schedule/route.ts");
const repository = read("./workScheduleRepository.ts");
const staffPage = read("../app/work-schedule/staff/page.tsx");
const organizationPage = read("../app/work-schedule/page.tsx");
const leadershipPage = read("../app/work-schedule/leadership/page.tsx");
const shell = read("../components/WorkSchedulePageShell.tsx");
const navigation = read("../components/phase2Navigation.ts");

test("regular employees can only query their own work schedule", () => {
  assert.match(route, /!canViewAllSchedules\(guard\.actor\)/);
  assert.match(route, /selfOnly \? guard\.actor\.id : undefined/);
  assert.match(repository, /\.contains\("participant_ids", \[participantId\]\)/);
});

test("employee plan page receives only the signed-in person and self scope", () => {
  assert.match(staffPage, /workScheduleRepository\.person\(user\.id\)/);
  assert.match(staffPage, /scheduleScope="self"/);
  assert.match(staffPage, /Chỉ hiển thị kế hoạch làm việc của chính bạn/);
  assert.match(shell, /scope=\$\{scheduleScope\}/);
});

test("organization and leadership pages reject direct access by regular employees", () => {
  for (const page of [organizationPage, leadershipPage]) {
    assert.match(page, /!user\.is_department_manager\)redirect\("\/work-schedule\/staff"\)/);
  }
  assert.match(navigation, /canViewAllSchedules \? \[\{ id: "work-schedule-leader"/);
});
