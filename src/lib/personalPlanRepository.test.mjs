import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const repository = read("./workScheduleRepository.ts");
const organizationRoute = read("../app/api/work-schedule/route.ts");

test("repository exposes explicit personal and organization boundaries", () => {
  assert.match(repository, /async listPersonal\(/);
  assert.match(repository, /async savePersonal\(/);
  assert.match(repository, /async reviewPersonal\(/);
  assert.match(repository, /async listOrganization\(/);
  assert.match(repository, /async saveOrganization\(/);
});

test("personal mutations use server RPCs and organization writes use organization scope", () => {
  assert.match(repository, /rpc\("api_create_personal_work_schedule"/);
  assert.match(repository, /rpc\("api_review_personal_work_schedule"/);
  assert.match(repository, /schedule_scope:\s*"organization"/);
  assert.doesNotMatch(repository, /reviewed_by\s*:\s*input/);
});

test("organization route does not invoke personal approval workflow", () => {
  assert.doesNotMatch(organizationRoute, /api_create_personal_work_schedule/);
  assert.doesNotMatch(organizationRoute, /PENDING_APPROVAL/);
  assert.match(organizationRoute, /saveOrganization|schedule_scope/);
});
