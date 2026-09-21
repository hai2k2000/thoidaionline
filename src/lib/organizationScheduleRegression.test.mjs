import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const route = read("../app/api/work-schedule/route.ts");
const repository = read("./workScheduleRepository.ts");

test("organization participants remain server-authorized", () => {
  assert.match(route, /guard\.actor\.role_code === "admin" && requestedParticipants\.length > 0/);
  assert.match(route, /participantIds = .*\[guard\.actor\.id\]/s);
});

test("organization updates retain owner-or-admin authorization", () => {
  assert.match(route, /saveOrganization\(guard\.actor\.id,[\s\S]*guard\.actor\.role_code === "admin"/);
  assert.match(repository, /if \(input\.id && !isAdmin\) query = query\.eq\("created_by", actorId\)/);
});

test("organization event validation remains strict", () => {
  assert.match(route, /body\.planType !== "business" && body\.planType !== "event"/);
  assert.match(route, /planType === "event" && endDate !== workDate/);
  assert.match(route, /planType === "event" && \(!time\.test\(startTime\) || !time\.test\(endTime\) || endTime <= startTime\)/);
});

test("organization delete retains owner-or-admin authorization", () => {
  assert.match(route, /removeOrganization\(guard\.actor\.id, id, guard\.actor\.role_code === "admin"\)/);
  assert.match(repository, /async removeOrganization\(actorId: string, id: string, isAdmin = false\)/);
  assert.match(repository, /if \(!isAdmin\) query = query\.eq\("created_by", actorId\)/);
});

test("organization writes remain approval-neutral while personal writes stay scoped", () => {
  assert.match(repository, /schedule_scope: "organization"/);
  assert.match(repository, /async savePersonal\(/);
  assert.match(repository, /api_create_personal_work_schedule/);
});
