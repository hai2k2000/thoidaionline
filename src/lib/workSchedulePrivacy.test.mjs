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

test("authenticated employees can view shared plans, with optional own-only compatibility", () => {
  assert.match(route, /params\.get\("scope"\) === "self" \? guard\.actor\.id : undefined/);
  assert.match(repository, /\.contains\("participant_ids", \[participantId\]\)/);
});

test("employee plan page defaults to own plans and can switch to shared scope", () => {
  assert.match(staffPage, /workScheduleRepository\.allPeople\(\)/);
  assert.match(staffPage, /scheduleScope="self"/);
  assert.match(staffPage, /Kế hoạch cá nhân/);
  assert.match(shell, /\/api\/work-schedule\/personal/);
  assert.match(shell, /\/api\/work-schedule/);
  assert.match(shell, /Kế hoạch toàn cơ quan/);
  assert.match(shell, /viewAll/);
});

test("organization and leadership pages reject direct access by regular employees", () => {
  for (const page of [organizationPage, leadershipPage]) {
    assert.match(page, /!user\.is_department_manager\)redirect\("\/work-schedule\/staff"\)/);
  }
  assert.match(navigation, /canViewAllSchedules \? \[\{ id: "work-schedule-leader"/);
});
