import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/attendance/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");
const attendanceLayout = readFileSync(new URL("../app/attendance/layout.tsx", import.meta.url), "utf8");
const myAttendanceLayout = readFileSync(new URL("../app/my-attendance/layout.tsx", import.meta.url), "utf8");
const evaluationRoute = readFileSync(new URL("../app/api/public-evaluation-summary/route.ts", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../components/phase2Navigation.ts", import.meta.url), "utf8");

test("attendance API requires a signed-in actor and validates the date/scope", () => {
  assert.match(route, /requireReadActor/);
  assert.match(route, /isValidDate\(date\)/);
  assert.match(route, /\["personal", "organization"\]/);
});

test("organization-wide attendance is restricted to admin", () => {
  assert.match(route, /scope === "organization" && guard\.actor\.role_code !== "admin"/);
  assert.match(route, /apiError\("forbidden", 403\)/);
  assert.match(route, /const organizationScope = scope === "organization"/);
});

test("personal attendance always filters by the signed-in actor", () => {
  assert.match(route, /if \(!organizationScope\)/);
  assert.match(route, /dayQuery = dayQuery\.eq\("user_id", guard\.actor\.id\)/);
  assert.match(route, /monthQuery = monthQuery\.eq\("user_id", guard\.actor\.id\)/);
  assert.match(route, /if \(!organizationScope\) users = users\.filter\(\(user\) => user\.id === guard\.actor\.id\)/);
});

test("browser attendance page uses the guarded API instead of direct Supabase access", () => {
  assert.match(page, /fetch\(`\/api\/attendance\?date=/);
  assert.doesNotMatch(page, /from\("attendance_logs"\)/);
  assert.doesNotMatch(page, /@\/lib\/supabase/);
});

test("organization evaluation summary remains visible to every signed-in employee", () => {
  assert.match(evaluationRoute, /requireReadActor/);
  assert.doesNotMatch(evaluationRoute, /role_code\s*!==\s*["']admin/);
  assert.match(navigation, /\{ id: "evaluation-summary", href: "\/evaluation-summary" \}/);
});

test("attendance screens enforce authentication and admin scope server-side", () => {
  assert.match(attendanceLayout, /getSessionUser/);
  assert.match(attendanceLayout, /user\.role_code !== "admin"/);
  assert.match(attendanceLayout, /redirect\("\/my-attendance"\)/);
  assert.match(myAttendanceLayout, /getSessionUser/);
  assert.match(myAttendanceLayout, /redirect\("\/login"\)/);
});
