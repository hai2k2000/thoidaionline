import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateEventAssignmentInput } from "./eventAssignmentValidation.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("accepts a valid multi-day local event", () => {
  assert.deepEqual(validateEventAssignmentInput({
    title: "Họp báo",
    eventType: "press_conference",
    workDate: "2026-09-21",
    endDate: "2026-09-22",
    startTime: "08:30",
    endTime: "17:00",
    reporterIds: ["reporter-1"],
  }), { ok: true });
});

test("rejects invalid dates, times, reversed intervals, and empty reporters", () => {
  for (const input of [
    { workDate: "2026-02-30", endDate: "2026-03-01", startTime: "08:00", endTime: "09:00" },
    { workDate: "2026-09-21", endDate: "2026-09-21", startTime: "8:00", endTime: "09:00" },
    { workDate: "2026-09-22", endDate: "2026-09-21", startTime: "10:00", endTime: "09:00" },
    { workDate: "2026-09-21", endDate: "2026-09-21", startTime: "10:00", endTime: "10:00" },
  ]) {
    assert.equal(validateEventAssignmentInput({
      title: "Sự kiện",
      eventType: "event",
      reporterIds: ["reporter-1"],
      ...input,
    }).ok, false);
  }
  assert.equal(validateEventAssignmentInput({
    title: "Sự kiện",
    eventType: "event",
    workDate: "2026-09-21",
    endDate: "2026-09-21",
    startTime: "10:00",
    endTime: "11:00",
    reporterIds: [],
  }).ok, false);
});

test("rejects duplicate or excessive reporters and oversized fields", () => {
  assert.equal(validateEventAssignmentInput({
    title: "Sự kiện",
    eventType: "event",
    workDate: "2026-09-21",
    endDate: "2026-09-21",
    startTime: "10:00",
    endTime: "11:00",
    reporterIds: ["a", "a"],
  }).ok, false);
  assert.equal(validateEventAssignmentInput({
    title: "Sự kiện",
    eventType: "event",
    workDate: "2026-09-21",
    endDate: "2026-09-21",
    startTime: "10:00",
    endTime: "11:00",
    reporterIds: Array.from({ length: 51 }, (_, index) => "r-" + index),
  }).ok, false);
});

test("migration defines isolated event assignment schema and all audit actions", () => {
  const migration = read("../../supabase/migrations/20260921150000_event_assignment_v1.sql");
  assert.match(migration, /work_schedule_event_assignments/);
  assert.match(migration, /event_assignment_kind/);
  assert.match(migration, /creator_department_id/);
  assert.match(migration, /event_status/);
  assert.match(migration, /unique\s*\(event_id,\s*staff_id\)/i);
  for (const action of ["create_event", "update_event", "assign_reporter", "unassign_reporter", "cancel_event", "complete_event"]) {
    assert.match(migration, new RegExp(action));
  }
  assert.doesNotMatch(migration, /online_work_schedules/);
  assert.doesNotMatch(migration, /create_task|insert into public\.tasks/i);
});

test("migration exposes security-definer RPCs with server-derived scope", () => {
  const migration = read("../../supabase/migrations/20260921150000_event_assignment_v1.sql");
  for (const fn of ["api_create_event_assignment", "api_update_event_assignment", "api_set_event_assignment_status"]) {
    assert.match(migration, new RegExp("create or replace function public\\." + fn));
    assert.match(migration, new RegExp("function public\\." + fn + "[\\s\\S]*security definer", "i"));
  }
  assert.match(migration, /tong_bien_tap/);
  assert.match(migration, /pho_tong_bien_tap/);
  assert.match(migration, /truong_phong/);
  assert.match(migration, /pho_truong_phong/);
  assert.match(migration, /phong_vien/);
  assert.match(migration, /department_id/);
  assert.match(migration, /participant_ids/);
});

test("event time inputs use an explicit 24-hour HH:mm format", () => {
  const panel = read("../components/EventAssignmentPanel.tsx");
  assert.match(panel, /Time24hInput/);
  assert.doesNotMatch(panel, /pattern="[^\"]*\\\\d/);
  assert.match(panel, /Time24hInput/);
});

test("event API never accepts client authorization fields and supports status actions", () => {
  const route = read("../app/api/work-schedule/events/route.ts");
  assert.match(route, /requireMutationActor/);
  assert.match(route, /saveEventAssignment/);
  assert.match(route, /setEventAssignmentStatus/);
  assert.doesNotMatch(route, /createdBy|creatorDepartmentId|assignedBy|approvalStatus/);
  assert.match(route, /cancel|complete/);
});

test("repository projects assignments and reporter reads without changing organization route", () => {
  const repository = read("./workScheduleRepository.ts");
  assert.match(repository, /listEventAssignments/);
  assert.match(repository, /saveEventAssignment/);
  assert.match(repository, /setEventAssignmentStatus/);
  assert.match(repository, /event_assignment_kind/);
  assert.match(repository, /schedule_scope.*organization/);
  assert.match(repository, /api_create_event_assignment/);
  assert.match(repository, /api_update_event_assignment/);
  assert.match(repository, /api_set_event_assignment_status/);
  assert.match(repository, /event_assignments:work_schedule_event_assignments/);
});

test("leadership UI exposes assignment action and reporter badge", () => {
  const panel = read("../components/EventAssignmentPanel.tsx");
  const shell = read("../components/WorkSchedulePageShell.tsx");
  const assignShell = read("../components/TaskAssignShell.tsx");
  assert.doesNotMatch(panel, /Tạo sự kiện \/ Phân công sự kiện/);
  assert.match(panel, /Time24hInput/);
  assert.match(panel, /participantIds|reporterIds/);
  assert.match(panel, /Được phân công/);
  assert.match(shell, /EventAssignmentPanel/);
  assert.doesNotMatch(panel, /api\/work-schedule\/personal/);
  assert.match(assignShell, /Phân công sự kiện/);
  assert.doesNotMatch(assignShell, /role="region" aria-label="Phân công sự kiện"/);
});

test("Personal Plan, Online Work, and Task boundaries remain explicit", () => {
  const personalRoute = read("../app/api/work-schedule/personal/route.ts");
  const onlineRepository = read("./onlineWorkRepository.ts");
  assert.match(read("./workScheduleRepository.ts"), /api_create_personal_work_schedule/);
  assert.doesNotMatch(onlineRepository, /event_assignment/);
});


test("all-staff migration changes only reporter eligibility and preserves RPC ACLs", () => {
  const previous = read("../../supabase/migrations/20260921150000_event_assignment_v1.sql");
  const migration = read("../../supabase/migrations/20261106180000_event_assignment_all_staff.sql");
  const oldPredicate = "(lower(coalesce(sj.code,'')) like 'phong_vien%' or lower(coalesce(sr.code,''))='phong_vien')";
  const newPredicate = "lower(trim(coalesce(sr.code,''))) not in ('admin','cong_tac_vien')\n        and lower(trim(coalesce(s.username,''))) <> 'admin'\n        and lower(trim(coalesce(s.full_name,''))) <> 'admin'";
  for (const name of ["api_create_event_assignment", "api_update_event_assignment"]) {
    const definition = (source) => source.slice(source.indexOf("create or replace function public." + name)).split("end $function$;")[0];
    assert.equal(definition(migration).replace(/\r\n/g, "\n"), definition(previous).replace(oldPredicate, newPredicate).replace(/\r\n/g, "\n"));
    for (const prefix of ["revoke all on function", "grant execute on function", "alter function"]) {
      const acl = previous.split("\n").find((line) => line.startsWith(prefix) && line.includes(name + "("));
      assert.ok(migration.includes(acl));
    }
  }
  assert.doesNotMatch(migration, /phong_vien/);
  assert.doesNotMatch(migration, /create or replace function public.api_set_event_assignment_status/);
});

test("assignment opens directly from header and retains grouped searchable staff selection", () => {
  const panel = read("../components/EventAssignmentPanel.tsx");
  const shell = read("../components/WorkSchedulePageShell.tsx");
  assert.match(shell, /onClick=\{\(\) => setEventOpen\(true\)\}/);
  assert.match(shell, /open=\{eventOpen\} onOpenChange=\{setEventOpen\}/);
  assert.match(panel, /Sự kiện đã phân công/);
  assert.doesNotMatch(panel, /Chọn phóng viên/);
  assert.match(panel, /Chọn nhân sự/);
  assert.match(panel, /selected.length/);
  assert.match(panel, /sortStaffRows\(people\)/);
  assert.match(panel, /person.departments\?\.name/);
  assert.match(panel, /person.job_titles\?\.name/);
  assert.match(panel, /search.trim/);
  assert.match(read("./workScheduleRepository.ts"), /departments\(name,code\)/);
  assert.match(read("../components/TaskAssignShell.tsx"), /work-schedule\/staff\?eventAssignment=1/);
});

test("dry-run restores a verified disposable backup and asserts body plus restricted grants", () => {
  const script = read("../../scripts/production/event-assignment-all-staff-dryrun.sh");
  for (const text of ["*-daily", "sha256sum", "pg_restore", "disk_guard_require", "safe-apply-migration.sh", "20261106180000", "phong_vien", "has_function_privilege('service_role'", "has_function_privilege('anon'", "has_function_privilege('authenticated'", "acl.grantee=0"]) assert.ok(script.includes(text), text);
  assert.doesNotMatch(script, /systemctl|docker system prune/);
});
