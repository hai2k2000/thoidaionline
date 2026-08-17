import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("staff API disambiguates the employee department relationship", () => {
  const route = read("../app/api/users/route.ts");
  assert.match(
    route,
    /departments!staff_users_department_id_fkey\(code,name\)/,
  );
  assert.doesNotMatch(route, /,departments\(code,name\)/);
});

test("department page uses the authenticated server boundary", () => {
  const page = read("../app/departments/page.tsx");
  const route = read("../app/api/departments/route.ts");
  const repository = read("./departmentRepository.ts");

  assert.match(page, /fetch\(["']\/api\/departments/);
  assert.doesNotMatch(page, /@\/lib\/supabase/);
  assert.match(route, /departmentHandlers/);
  assert.match(repository, /server-only/);
  assert.match(repository, /serverSupabase/);
});

test("department reads and writes are Admin-only and mutations are same-origin", () => {
  const handlers = read("./departmentHandlers.ts");
  assert.match(handlers, /requireReadActor/);
  assert.match(handlers, /requireMutationActor/);
  assert.match(handlers, /actor\.role_code\s*!==\s*["']admin["']/);
  assert.match(handlers, /can_manage_users/);
  assert.match(handlers, /forbidden/);
});

test("department mutations accept only explicit validated fields", () => {
  const handlers = read("./departmentHandlers.ts");
  assert.match(handlers, /DEPARTMENT_CODE_PATTERN/);
  assert.match(handlers, /active/);
  assert.doesNotMatch(handlers, /serverSupabase/);
});
