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


test("department page hides locked rows by default and keeps an unlock filter", () => {
  const page = read("../app/departments/page.tsx");
  assert.match(page, /useState<DepartmentStatusFilter>\("active"\)/);
  assert.match(page, /Đang hoạt động/);
  assert.match(page, /Đã khóa/);
  assert.match(page, /Tất cả/);
  assert.match(page, /visibleDepartments/);
  assert.match(page, /visibleDepartments\.map/);
  assert.match(page, /active: !d\.active/);
  assert.match(page, /Hiển thị.*visibleDepartments\.length/);
});

test("user page shows active staff by default and exposes lock controls", () => {
  const page = read("../app/users/page.tsx");
  const route = read("../app/api/users/route.ts");
  assert.match(page, />\("active"\)/);
  assert.match(page, /Trạng thái: Đang hoạt động/);
  assert.match(page, /Trạng thái: Đã khóa/);
  assert.match(page, /Trạng thái: Tất cả/);
  assert.match(page, /toggleUserActive/);
  assert.match(page, /u\.active \? "Khóa" : "Mở khóa"/);
  assert.match(route, /Không thể tự khóa tài khoản đang đăng nhập/);
});


test("job-title catalog keeps exactly seven canonical active titles", () => {
  const migration = read("../../supabase/migrations/20260819103000_canonical_job_titles.sql");
  const page = read("../app/job-titles/page.tsx");
  const route = read("../app/api/job-titles/route.ts");
  for (const code of ["tong_bien_tap","pho_tong_bien_tap","truong_phong","pho_truong_phong","ke_toan_truong","phong_vien","nhan_vien"]) assert.match(migration, new RegExp(code));
  assert.doesNotMatch(migration, /delete\s+from\s+public\.job_titles/i);
  assert.match(migration, /active=false/);
  assert.match(page, /JobTitleStatusFilter/);
  assert.match(page, /Đang hoạt động/);
  assert.match(page, /Đã khóa/);
  assert.match(page, /Tất cả/);
  assert.match(page, /Cũ/);
  assert.match(route, /CANONICAL_JOB_TITLE_CODES/);
});
