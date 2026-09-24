import assert from "node:assert/strict";
import test from "node:test";

import { personalPlanErrorMessage } from "./personalPlanError.ts";

test("personal plan API codes map to safe Vietnamese messages", () => {
  assert.match(personalPlanErrorMessage("invalid_request"), /chưa hợp lệ/);
  assert.match(personalPlanErrorMessage("unauthenticated"), /đăng nhập lại/);
  assert.match(personalPlanErrorMessage("operation_failed"), /thử lại/);
});

test("unknown API codes use the generic fallback", () => {
  assert.equal(
    personalPlanErrorMessage("database_secret"),
    "Không thể tạo kế hoạch. Vui lòng kiểm tra lại thông tin.",
  );
});
