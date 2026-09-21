import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("personal plan page is public to authenticated users and is named correctly", () => {
  const page = read("../app/work-schedule/staff/page.tsx");
  const nav = read("../components/phase2Navigation.ts");
  const appNav = read("../components/AppNav.tsx");
  assert.match(page, /scheduleScope="self"/);
  assert.match(page, /Kế hoạch cá nhân/);
  assert.match(nav, /work-schedule-staff/);
  assert.match(appNav, /work-schedule-staff": "Kế hoạch cá nhân"/);
  assert.match(page, /Lịch làm việc, công tác và sự kiện của bạn/);
});

test("Personal Plan API allows authenticated users to create only their own plan", () => {
  const route = read("../app/api/work-schedule/personal/route.ts");
  const repository = read("./workScheduleRepository.ts");
  assert.match(route, /requireMutationActor/);
  assert.match(route, /guard\.actor\.id/);
  assert.match(route, /input\.participantIds = \[guard\.actor\.id\]/);
  assert.match(route, /endDate/);
  assert.match(route, /planType/);
  assert.match(repository, /rpc\("api_create_personal_work_schedule"/);
});

test("personal plan UI lets the creator edit or delete their own plan", () => {
  const page = read("../app/work-schedule/staff/page.tsx");
  const shell = read("../components/WorkSchedulePageShell.tsx");
  assert.match(page, /currentUserId=\{user\.id\}/);
  assert.match(shell, /Sửa kế hoạch/);
  assert.match(shell, /Xóa kế hoạch/);
  assert.match(shell, /method: "DELETE"/);
  assert.match(shell, /Kế hoạch toàn cơ quan/);
  assert.match(shell, /viewAll/);
});

test("personal plan form offers date-range trips and single-day events with required times", () => {
  const shell = read("../components/WorkSchedulePageShell.tsx");
  assert.doesNotMatch(shell, /<option value="work">/);
  assert.match(shell, /<option value="business">Đi công tác<\/option>/);
  assert.match(shell, /<option value="event">Sự kiện<\/option>/);
  assert.match(shell, /planType === "event"/);
  assert.match(shell, /Ngày sự kiện/);
  assert.match(shell, /name="startTime" type="time" required/);
  assert.match(shell, /name="endTime" type="time" required/);
  assert.match(shell, /Từ giờ/);
  assert.match(shell, /Đến giờ/);
});

test("Personal Plan API requires valid local dates and HH:mm times for every plan", () => {
  const route = read("../app/api/work-schedule/personal/route.ts");
  assert.match(route, /validateLocalPlanInterval/);
  assert.match(route, /TIME\.test\(startTime\)/);
  assert.match(route, /TIME\.test\(endTime\)/);
  assert.match(route, /startTime,/);
  assert.match(route, /endTime,/);
});

test("work schedule admin form sends a valid business plan payload", () => {
  const adminShell = read("../components/WorkScheduleAdminShell.tsx");
  assert.match(adminShell, /planType:\"business\"/);
  assert.match(adminShell, /endDate:workDate/);
});

test("work schedule storage supports plan type and date ranges", () => {
  const migration = readFileSync(new URL("../../supabase/migrations/20260915120000_personal_work_plans.sql", import.meta.url), "utf8");
  assert.match(migration, /add column if not exists end_date/);
  assert.match(migration, /add column if not exists plan_type/);
});

test("attendance leave form no longer offers business trips", () => {
  const page = read("../app/attendance/page.tsx");
  assert.match(page, /Gửi đơn xin nghỉ/);
  assert.doesNotMatch(page, /Gửi đơn nghỉ \/ công tác/);
  assert.doesNotMatch(page, /<option value="business">Công tác<\/option>/);
});
