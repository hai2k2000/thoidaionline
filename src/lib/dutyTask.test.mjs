import assert from "node:assert/strict"; import { readFileSync } from "node:fs"; import test from "node:test";
const migration = readFileSync("supabase/migrations/20260821150000_monthly_duty_tasks.sql", "utf8"); const repo = readFileSync("src/lib/taskRepository.ts", "utf8"); const filters = readFileSync("src/lib/taskFilters.mjs", "utf8"); const shell = readFileSync("src/components/TaskCenterShell.tsx", "utf8");
test("duty tasks are evaluation-visible and categorized", () => { assert.match(migration, /task_category/); assert.match(migration, /api_create_duty_task/); assert.match(repo, /task_category/); }); test("task center excludes duty tasks from the general list", () => { assert.match(filters, /category/); assert.match(repo, /neq\("task_category", "duty"\)/); assert.doesNotMatch(shell, />Trực sản xuất</); });

test("personal and organization duty schedules share one viewer filter", () => {
  const nav = readFileSync("src/components/phase2Navigation.ts", "utf8");
  const route = readFileSync("src/app/api/duty-schedule/route.ts", "utf8");
  const viewer = readFileSync("src/components/DutyScheduleViewer.tsx", "utf8");
  const page = readFileSync("src/app/duty-schedule/page.tsx", "utf8");
  assert.doesNotMatch(nav, /my-duty-schedule/);
  assert.match(route, /mine \? guard\.actor\.id/);
  assert.match(viewer, /Toàn cơ quan/);
  assert.match(viewer, />Cá nhân/);
  assert.match(page, /scope !== "personal"/);
  assert.match(page, /taskMode/);
});

test("each duty day requires four mandatory positions", () => { const positions = readFileSync("src/lib/dutyRoster.mjs", "utf8"); for (const position of ["Biên tập và xuất bản","Biên tập bước 2","Biên tập bước 1","Phóng viên"]) assert.match(positions, new RegExp(position)); assert.match(readFileSync("supabase/migrations/20260822070000_monthly_duty_roster.sql", "utf8"), /each duty day requires four positions/); });

test("monthly roster generates every calendar day without persisting blanks", async () => {
  const { monthDays, completeRows } = await import("./dutyRoster.mjs");
  assert.equal(monthDays("2028-02").length, 29);
  assert.equal(monthDays("2027-02").length, 28);
  assert.equal(monthDays("2026-04").length, 30);
  assert.equal(monthDays("2026-08").length, 31);
  const days = monthDays("2026-08");
  days[0].assignments = { a: "1", b: "2", c: "3", d: "4" };
  days[1].assignments = { a: "1", b: "", c: "3", d: "4" };
  assert.deepEqual(completeRows(days, ["a", "b", "c", "d"]).map((day) => day.date), ["2026-08-01", "2026-08-02"]);
});

test("duty endpoint supports admin GET and one transactional batch RPC", () => {
  const route = readFileSync("src/app/api/tasks/duty/route.ts", "utf8");
  const repository = readFileSync("src/lib/dutyTaskRepository.ts", "utf8");
  assert.match(route, /export async function GET/);
  assert.match(route, /role_code !== "admin"/);
  assert.match(repository, /api_save_monthly_duty_roster/);
  assert.doesNotMatch(route, /for \(const row of rows\)[\s\S]*dutyTaskRepository\.create/);
});

test("forward-only duty roster migration enforces atomic security and cancelled replacement", () => {
  const sql = readFileSync("supabase/migrations/20260822070000_monthly_duty_roster.sql", "utf8");
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /jsonb_array_length/);
  assert.match(sql, /api_save_monthly_duty_roster/);
  assert.match(sql, /status <> 'cancelled'/);
  assert.match(sql, /ineligible duty reviewer/);
  assert.match(sql, /ineligible duty assignee/);
  assert.match(sql, /create_duty|update_duty|cancel_duty/);
  assert.match(sql, /revoke all on function public\.api_save_monthly_duty_roster/);
  assert.match(sql, /grant execute on function public\.api_save_monthly_duty_roster/);
});

test("publication duty position allows organization-wide editors while reporters remain department-scoped", () => {
  const sql = readFileSync("supabase/migrations/20260822074500_duty_exclude_general.sql", "utf8");
  assert.match(sql, /v_position='Biên tập và xuất bản'/);
  assert.match(sql, /v_assignee_department is distinct from p_department_id/);
  assert.match(sql, /v_position<>'Biên tập và xuất bản'/);
});

test("general department is fail-closed for monthly roster", () => {
  const sql = readFileSync("supabase/migrations/20260822074500_duty_exclude_general.sql", "utf8");
  assert.match(sql, /code <> 'general'/);
  assert.match(sql, /selected duty department is excluded/);
  assert.match(sql, /assignee department is excluded/);
});

test("roster month end uses valid PostgreSQL interval arithmetic", () => {
  const sql = readFileSync("supabase/migrations/20260822080000_duty_interval_fix.sql", "utf8");
  assert.match(sql, /interval '1 month' - interval '1 day'/);
  assert.doesNotMatch(sql, /interval '1 month-1 day'/);
});

test("duty IA separates admin configuration from organization viewer", () => {
  const nav = readFileSync("src/components/phase2Navigation.ts", "utf8");
  const legacy = readFileSync("src/app/tasks/duty/page.tsx", "utf8");
  const admin = readFileSync("src/app/configuration/duty-roster/page.tsx", "utf8");
  assert.match(nav, /duty-schedule/);
  assert.match(nav, /duty-roster/);
  assert.match(legacy, /redirect\("\/configuration\/duty-roster"\)/);
  assert.match(admin, /role_code !== "admin"/);
});

test("viewer ranges are day week month bounded and use local calendar dates", async () => {
  const { scheduleRange } = await import("./dutyScheduleRange.mjs");
  assert.deepEqual(scheduleRange("day", "2026-08-22"), { from: "2026-08-22", to: "2026-08-22" });
  assert.deepEqual(scheduleRange("week", "2026-08-22"), { from: "2026-08-17", to: "2026-08-23" });
  assert.deepEqual(scheduleRange("month", "2028-02-10"), { from: "2028-02-01", to: "2028-02-29" });
});

test("organization schedule GET is authenticated, bounded and read-only", () => {
  const route = readFileSync("src/app/api/duty-schedule/route.ts", "utf8");
  const repository = readFileSync("src/lib/dutyTaskRepository.ts", "utf8");
  assert.match(route, /requireReadActor/);
  assert.match(route, /MAX_RANGE_DAYS/);
  assert.doesNotMatch(route, /export async function POST/);
  assert.match(repository, /neq\("status", "cancelled"\)/);
  assert.match(repository, /assignee:staff_users/);
});

test("duty roster RPC enforces 22:00 deadline with service-role-only ACL", () => { const sql = readFileSync("supabase/migrations/20260822090000_duty_deadline_2200.sql", "utf8"); assert.match(sql, /22:00/); assert.doesNotMatch(sql, /17:00/); assert.match(sql, /due_time=time .22:00./); assert.match(sql, /revoke all on function public\.api_save_monthly_duty_roster/); assert.match(sql, /grant execute on function public\.api_save_monthly_duty_roster.*service_role/); });

test("step editor positions are limited to the three named accounts", () => { const shell = readFileSync("src/components/DutyTaskShell.tsx", "utf8"); const repo = readFileSync("src/lib/dutyTaskRepository.ts", "utf8"); const sql = readFileSync("supabase/migrations/20260822100000_duty_step_editors.sql", "utf8"); for (const username of ["leson", "triduong", "thihung"]) { assert.match(shell, new RegExp(username)); assert.match(sql, new RegExp(username)); } assert.match(repo, /id,username,full_name/); assert.match(shell, /person\.username \+ " \(" \+ person\.full_name/); assert.match(sql, /v_position in \('Biên tập bước 2','Biên tập bước 1'\)/); });
