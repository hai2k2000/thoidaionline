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

test("work schedule API allows authenticated users to create only their own plan", () => {
  const route = read("../app/api/work-schedule/route.ts");
  const repository = read("./workScheduleRepository.ts");
  assert.doesNotMatch(route, /guard\.actor\.role_code !== "admin"/);
  assert.match(route, /guard\.actor\.id/);
  assert.match(route, /requestedParticipants\.length > 0/);
  assert.match(route, /participantIds.*guard\.actor\.id|guard\.actor\.id.*participantIds/);
  assert.match(route, /endDate/);
  assert.match(route, /planType/);
  assert.match(repository, /eq\("created_by", actorId\)/);
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

test("personal plan form only offers business trips and single-day events", () => {
  const shell = read("../components/WorkSchedulePageShell.tsx");
  assert.doesNotMatch(shell, /<option value="work">/);
  assert.match(shell, /<option value="business">Đi công tác<\/option>/);
  assert.match(shell, /<option value="event">Sự kiện<\/option>/);
  assert.match(shell, /planType === "event"/);
  assert.match(shell, /Ngày sự kiện/);
  assert.match(shell, /row\.plan_type === "event" \? "Cả ngày"/);
  assert.doesNotMatch(shell, /name="startTime"/);
  assert.doesNotMatch(shell, /name="endTime"/);
});

test("work schedule API rejects work plans and enforces event dates without hours", () => {
  const route = read("../app/api/work-schedule/route.ts");
  assert.match(route, /body\.planType !== "business" && body\.planType !== "event"/);
  assert.match(route, /planType === "event" && endDate !== workDate/);
  assert.match(route, /startTime: null/);
  assert.match(route, /endTime: null/);
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
