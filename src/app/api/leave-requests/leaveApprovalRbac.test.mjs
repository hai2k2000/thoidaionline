import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/leave-requests/route.ts", "utf8");
const approval = readFileSync("src/lib/rbac/approval.ts", "utf8");

test("leave approval route delegates authorization to the approval RPCs", () => {
  assert.doesNotMatch(route, /REVIEW_ROLES|GLOBAL_REVIEW_ROLES|TBT_ROLE|requiresTbtApproval|\bcanReview\b/);
  assert.match(route, /api_list_reviewable_leave_requests/);
  assert.match(route, /getApprovalCapabilities/);
  assert.match(approval, /api_get_approval_capabilities/);
  assert.match(route, /p_actor:\s*guard\.actor\.id/);
  assert.doesNotMatch(route, /body\??\.departmentId|body\??\.actorId|body\??\.scope/);
  assert.doesNotMatch(route, /role_code\s*===\s*["'](?:tong_bien_tap|pho_tong_bien_tap|phu_trach_[^"']+)["']/);
  assert.doesNotMatch(route, /from\(["']leave_requests["']\)\.select\(["']start_date,end_date/);
});
