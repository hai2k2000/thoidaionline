import assert from "node:assert/strict";
import test from "node:test";

import { mapRpcError } from "./rpcErrorMapping.ts";
import { apiError } from "./apiResponse.ts";
import { responseErrorMessage } from "./actionFeedback.ts";

test("normal reviewer trigger failures reach the UI with specific Vietnamese feedback", async () => {
  for (const [code, message, status] of [
    ["42501", "Người duyệt phải là Trưởng hoặc Phó phòng.", 403],
    ["42501", "Người duyệt phải thuộc phòng ban của công việc.", 403],
    ["22023", "Người duyệt không hợp lệ.", 400],
  ]) {
    const mapped = mapRpcError({ code, message });
    assert.equal(mapped.status, status);
    assert.equal(await responseErrorMessage(apiError(mapped.code, mapped.status), "fallback"), message);
  }
});

test("admin assignment participant rejection produces Vietnamese feedback", async () => {
  const mapped = mapRpcError({ code: "42501", message: "Admin cannot be an assignment participant." });
  assert.deepEqual(mapped, { code: "admin_assignment_participant_forbidden", status: 403 });
  assert.equal(await responseErrorMessage(apiError(mapped.code, mapped.status), "fallback"), "Không thể chọn tài khoản quản trị làm người tham gia");
});

test("missing assignee manager produces actionable Vietnamese feedback", async () => {
  const mapped = mapRpcError({ code: "22023", message: "Assignee department requires an active primary manager." });
  assert.deepEqual(mapped, { code: "assignee_department_manager_required", status: 400 });
  assert.equal(await responseErrorMessage(apiError(mapped.code, mapped.status), "fallback"), "Phòng của người nhận việc chưa có trưởng phòng");
  assert.deepEqual(mapRpcError({ code: "22023", message: "Invalid participant roles." }), { code: "invalid_request", status: 400, field: "participants" });
});

test("serialization failures map to HTTP 409 across Supabase error shapes", () => {
  assert.deepEqual(mapRpcError({ code: "40001" }), { code: "conflict", status: 409 });
  assert.deepEqual(mapRpcError({ details: "40001" }), { code: "conflict", status: 409 });
  assert.deepEqual(mapRpcError({ code: "55000" }), { code: "conflict", status: 409 });
  assert.deepEqual(mapRpcError({ details: "55000" }), { code: "conflict", status: 409 });
  assert.deepEqual(
    mapRpcError({ message: "Publication report changed before verification." }),
    { code: "conflict", status: 409 },
  );
});

test("self-verification and validation keep their existing status codes", () => {
  assert.deepEqual(mapRpcError({ code: "42501" }), { code: "forbidden", status: 403 });
  assert.deepEqual(mapRpcError({ code: "22023" }), { code: "invalid_request", status: 400 });
});

test("admin task mutation failures identify the affected field", () => {
  assert.deepEqual(mapRpcError({ code: "22023", message: "Invalid participant roles." }), { code: "invalid_request", status: 400, field: "participants" });
  assert.deepEqual(mapRpcError({ code: "42501", message: "Cancelled task cannot be mutated." }), { code: "forbidden", status: 403, field: "status" });
  assert.deepEqual(mapRpcError({ code: "22023", message: "Use report/review for completion transitions." }), { code: "invalid_request", status: 400, field: "status" });
});

test("unexpected database failures remain HTTP 500", () => {
  assert.deepEqual(
    mapRpcError({ code: "XX000", message: "unexpected" }),
    { code: "operation_failed", status: 500 },
  );
});
