import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");

// attendance_logs may reference staff_users through more than one column;
// unhinted embeds make PostgREST fail with PGRST201 (production 2026-10-28).
test("attendance_logs selects embed staff_users through the user_id foreign key", () => {
  const selects = [...route.matchAll(/\.from\("attendance_logs"\)\s*\.select\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(selects.length > 0);
  for (const fields of selects) {
    if (!fields.includes("staff_users")) continue;
    assert.match(fields, /staff_users!attendance_logs_user_id_fkey\(/);
    assert.doesNotMatch(fields, /(^|,)staff_users\(/);
  }
});

test("migration 20261028180000 drops only the reviewer foreign key", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261028180000_attendance_logs_drop_reviewer_fk.sql", import.meta.url), "utf8");
  assert.match(sql, /drop constraint if exists attendance_logs_late_exception_reviewed_by_fkey/);
  assert.doesNotMatch(sql, /drop column/i);
  assert.match(sql, /notify pgrst, 'reload schema'/);
});
