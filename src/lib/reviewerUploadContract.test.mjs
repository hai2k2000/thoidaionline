import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const policy = read("./taskReviewerPolicy.mjs");
const repository = read("./taskAssignmentRepository.ts");
const group = read("./taskAssignmentGroup.ts");
const authorization = read("./authorization.ts");
const factory = read("./taskHandlerFactory.ts");
const handlers = read("./taskHandlers.ts");
const migration = read("../../supabase/migrations/20260820180000_task_assignment_leadership_upload.sql");

test("reviewer policy includes both canonical leaders and scoped department managers", () => {
  assert.match(policy, /tong_bien_tap/);
  assert.match(policy, /pho_tong_bien_tap/);
  assert.match(policy, /truong_phong/);
  assert.match(policy, /pho_truong_phong/);
  assert.match(repository, /isEligibleAssignmentReviewer/);
  assert.match(repository, /canReviewOutsideDepartment/);
  assert.match(group, /canReviewOutsideDepartment/);
  assert.match(authorization, /isLeadershipAssignmentReviewer/);
});

test("RPC independently accepts canonical leadership and rejects forged reviewers", () => {
  assert.match(migration, /lower\(rr\.code\)\s+in\s*\('tong_bien_tap','pho_tong_bien_tap'\)/i);
  assert.match(migration, /u\.active\s*=\s*true/i);
  assert.match(migration, /u\.department_id\s*=\s*p_department_id/i);
  assert.match(migration, /truong_phong','pho_truong_phong/i);
  assert.match(migration, /Invalid assignee, reviewer or manager/);
  assert.match(migration, /revoke all[\s\S]*public,anon,authenticated/i);
  assert.match(migration, /grant execute[\s\S]*service_role/i);
});

test("Unicode display names never enter storage object keys", () => {
  assert.match(factory, /storagePath\s*=\s*`\$\{taskId\}\/\$\{deps\.newUuid\(\)\}\.\$\{extension\}`/);
  assert.doesNotMatch(factory, /safeName|\$\{deps\.newUuid\(\)\}-\$\{[^}]*file/i);
  assert.match(factory, /fileName:\s*file\.name\.slice/);
  assert.match(factory, /file\.size\s*>\s*10485760/);
  assert.match(factory, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.match(factory, /await deps\.removePrivateAttachment\(storagePath\)/);
  assert.match(handlers, /contentType:\s*mimeType/);
});
