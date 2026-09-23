import assert from "node:assert/strict";
import test from "node:test";
import { calendarActorScope, plannedPublicationPatch } from "./journalismCalendarRepositoryPolicy.mjs";

test("calendar scope is always content department and reporter scope is assigned", () => {
  assert.deepEqual(calendarActorScope({ id: "u1", departmentId: "d1", departmentCode: "editorial", roleCode: "phong_vien" }), {
    departmentId: "d1", scope: "assigned",
  });
  assert.deepEqual(calendarActorScope({ id: "u2", departmentId: "d1", departmentCode: "editorial", roleCode: "tong_bien_tap" }), {
    departmentId: "d1", scope: "all",
  });
  assert.deepEqual(calendarActorScope({ id: "u5", departmentId: "d9", departmentCode: "business", roleCode: "tong_bien_tap" }), {
    departmentId: "d9", scope: "all",
  });
  assert.deepEqual(calendarActorScope({ id: "u4", departmentId: "d1", departmentCode: "editorial", roleCode: "truong_phong" }), {
    departmentId: "d1", scope: "all",
  });
  assert.equal(calendarActorScope({ id: "u3", departmentId: "d2", departmentCode: "hr", roleCode: "admin" }), null);
});

test("planned date patch has no fields outside the safe allowlist", () => {
  assert.deepEqual(plannedPublicationPatch("2026-09-24T09:00:00+07:00"), {
    p_planned_publication_at: "2026-09-24T09:00:00+07:00",
  });
  assert.deepEqual(plannedPublicationPatch(null), { p_planned_publication_at: null });
});
