import assert from "node:assert/strict";
import test from "node:test";

import { buildAttendanceSyncClaimFilter } from "./attendanceSyncRecovery.ts";

test("claim filter reclaims completing requests whose lease is old or missing", () => {
  assert.equal(
    buildAttendanceSyncClaimFilter("2026-09-11T10:00:00.000Z"),
    "status.eq.pending,and(status.eq.completing,or(started_at.lt.2026-09-11T10:00:00.000Z,and(started_at.is.null,requested_at.lt.2026-09-11T10:00:00.000Z)))",
  );
});
