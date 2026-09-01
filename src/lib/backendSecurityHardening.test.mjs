import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("sensitive business tables are service-role only", () => {
  const migration = read("../../supabase/migrations/20260901095000_backend_security_hardening.sql");
  for (const table of [
    "employee_profiles", "assets", "asset_assignments", "official_documents",
    "document_assignments", "work_schedules", "password_reset_tokens",
    "password_reset_attempts",
  ]) assert.match(migration, new RegExp(`'${table}'`));
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all privileges[\s\S]*public, anon, authenticated/i);
  assert.match(migration, /grant select, insert, update, delete[\s\S]*service_role/i);
  assert.match(migration, /set public = false/i);
  assert.match(migration, /drop policy if exists "public read task-files"/i);
  assert.match(migration, /drop policy if exists "public write task-files"/i);
});

test("reports and notification jobs query with the server Supabase client", () => {
  for (const path of [
    "../app/api/reports/summary/route.ts",
    "../app/api/notify/due-soon/route.ts",
    "../app/api/notify/doc-overdue/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /serverSupabase/);
    assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY|createClient\(/);
  }
});

test("HR uploads require app auth and use private runtime storage", () => {
  const route = read("../app/api/hr/upload/route.ts");
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /getSessionUser/);
  assert.match(route, /10 \* 1024 \* 1024/);
  assert.match(route, /format\.signature\.every/);
  assert.match(route, /"storage", "uploads", "hr"/);
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /"public", "uploads"/);
  assert.doesNotMatch(route, /\(e as Error\)\.message/);
});

test("HR asset and document browser pages no longer use the anonymous client", () => {
  for (const path of [
    "../app/assets/page.tsx", "../app/assets/new/page.tsx", "../app/assets/[id]/page.tsx",
    "../app/documents/new/page.tsx", "../app/documents/[id]/page.tsx",
    "../app/hr-profiles/[id]/page.tsx",
  ]) assert.doesNotMatch(read(path), /@\/lib\/supabase|supabase\.from\(/, path);

  for (const path of ["./services/assets.ts", "./services/documents.ts", "./services/hrProfiles.ts"]) {
    const source = read(path);
    assert.match(source, /fetch\("\/api\//);
    assert.doesNotMatch(source, /db\.from\(/);
  }
});

test("replacement APIs check the app session and mutations check same-origin", () => {
  for (const path of [
    "../app/api/assets/route.ts", "../app/api/assets/[id]/route.ts",
    "../app/api/documents/route.ts", "../app/api/documents/[id]/route.ts",
    "../app/api/hr/profiles/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /getSessionUser/);
    assert.match(source, /serverSupabase/);
  }
  for (const path of [
    "../app/api/assets/route.ts", "../app/api/assets/[id]/route.ts",
    "../app/api/documents/route.ts", "../app/api/hr/profiles/route.ts",
  ]) assert.match(read(path), /isSameOriginRequest/);
});
