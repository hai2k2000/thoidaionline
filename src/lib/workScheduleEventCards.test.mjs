import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { splitCellEvents, summarizeParticipants } from "./workScheduleEventCards.mjs";
import { canAssignEvents, eventAssignmentPeople } from "./workScheduleEventAccess.ts";

test("assignment permission matches API roles and department manager flag", () => {
  for (const role_code of ["admin", "tong_bien_tap", "pho_tong_bien_tap", "truong_phong"]) {
    assert.equal(canAssignEvents({ role_code, is_department_manager: false }), true);
  }
  for (const role_code of ["phong_vien", "pho_truong_phong", "nhan_vien", ""]) {
    assert.equal(canAssignEvents({ role_code, is_department_manager: false }), false);
    assert.equal(canAssignEvents({ role_code, is_department_manager: true }), true);
  }
});

test("assignment people include all active staff within the actor scope", () => {
  const people = [
    { id: "a", active: true, department_id: "one", roles: { code: "truong_phong" } },
    { id: "b", active: true, department_id: "two", job_titles: { code: "bien_tap_vien" } },
    { id: "c", active: true, department_id: "one", roles: { code: "nhan_vien" } },
    { id: "d", active: true, department_id: "one", roles: { code: "cong_tac_vien" } },
    { id: "inactive", active: false, department_id: "one" },
    { id: "admin", active: true, department_id: "one", roles: { code: "admin" } },
    { id: "system", active: true, department_id: "one", username: " Admin " },
  ];
  for (const role_code of ["admin", "tong_bien_tap", "pho_tong_bien_tap"]) {
    assert.deepEqual(eventAssignmentPeople(people, { role_code, department_id: "one" }).map((p) => p.id), ["a", "b", "c"]);
  }
  assert.deepEqual(eventAssignmentPeople(people, { role_code: "truong_phong", department_id: "one" }).map((p) => p.id), ["a", "c"]);
  assert.deepEqual(eventAssignmentPeople([{ active: true, department_id: null }], { role_code: "truong_phong", department_id: null }), []);
});

test("empty and exact-limit cells and participant lists have no overflow", () => {
  assert.deepEqual(splitCellEvents([], 3), { visible: [], overflow: [] });
  assert.deepEqual(splitCellEvents([1, 2, 3], 3), { visible: [1, 2, 3], overflow: [] });
  assert.deepEqual(summarizeParticipants([], 5), { names: [], remaining: 0 });
  assert.deepEqual(summarizeParticipants(["A", "B"], 5), { names: ["A", "B"], remaining: 0 });
});

test("summarizes participants with the remaining count", () => {
  assert.deepEqual(summarizeParticipants(["Nguyễn Văn A", "Trần Thị B", "Lê Văn C"], 2), {
    names: ["Nguyễn Văn A", "Trần Thị B"],
    remaining: 1,
  });
});

test("splits a cell into visible cards and overflow events", () => {
  const result = splitCellEvents([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }], 3);
  assert.deepEqual(result.visible.map((row) => row.id), ["a", "b", "c"]);
  assert.deepEqual(result.overflow.map((row) => row.id), ["d"]);
});

test("staff page gates event assignment with the shared permission helper", () => {
  const source = readFileSync(new URL("../app/work-schedule/staff/page.tsx", import.meta.url), "utf8");
  assert.match(source, /canAssignEvents/);
  assert.match(source, /enableEventAssignment=\{canAssignEvents\}/);
  assert.match(source, /eventPeople=\{canAssignEvents \? eventPeople as never : undefined\}/);
});

test("schedule shell contains compact cards, portal tooltip, overflow action, and detail dialog", () => {
  const source = readFileSync(new URL("../components/WorkSchedulePageShell.tsx", import.meta.url), "utf8");
  assert.match(source, /line-clamp-2/);
  assert.match(source, /\+\{.*sự kiện/);
  assert.match(source, /createPortal/);
  assert.match(source, /role="dialog" aria-modal="true"/);
});
