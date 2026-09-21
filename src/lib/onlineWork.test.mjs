import assert from "node:assert/strict";import {readFileSync} from "node:fs";import test from "node:test";
test("online work schedule is isolated and reporter-only",()=>{const sql=readFileSync("supabase/migrations/20260822140000_online_work_foreign_reporters_only.sql","utf8");assert.match(sql,/create table if not exists public\.online_work_schedules/);assert.match(sql,/lower\(jt\.code\) like 'phong_vien_%'/);assert.match(sql,/online worker must be an active reporter/);assert.match(sql,/revoke all on function public\.api_save_monthly_online_work_schedule/);assert.match(sql,/grant execute on function public\.api_save_monthly_online_work_schedule.*service_role/);});
test("admin saves one or more reporters per date transactionally",()=>{const route=readFileSync("src/app/api/online-work/route.ts","utf8");const repo=readFileSync("src/lib/onlineWorkRepository.ts","utf8");assert.match(route,/role_code !== "admin"/);assert.match(route,/staffIds\.length > 6/);assert.match(route,/new Set\(staffIds\)/);assert.match(repo,/api_save_monthly_online_work_schedule/);assert.match(repo,/job_titles\.code", "phong_vien_%"/); assert.match(repo,/in\("username", Object.keys\(FOREIGN_REPORTERS\)\)/);});
test("authenticated viewer supports bounded day week month views",()=>{const route=readFileSync("src/app/api/online-work-schedule/route.ts","utf8");const viewer=readFileSync("src/components/OnlineWorkViewer.tsx","utf8");const nav=readFileSync("src/components/phase2Navigation.ts","utf8");assert.match(route,/requireReadActor/);assert.match(route,/MAX_RANGE_DAYS = 42/);assert.doesNotMatch(route,/export async function POST/);assert.match(viewer,/"day"\|"week"\|"month"/);assert.match(viewer,/Thời gian/);assert.match(viewer,/Người làm online/);assert.match(nav,/configuration\/online-work/);});

test("online work admin cards constrain long reporter labels",()=>{ const shell=readFileSync("src/components/OnlineWorkAdminShell.tsx","utf8"); assert.match(shell,/grid min-w-0 gap-2/); assert.match(shell,/min-w-0 max-w-full truncate rounded border/); assert.match(shell,/overflow-hidden rounded border/); });

test("language role labels are explicit",()=>{ const language=readFileSync("src/lib/onlineWorkLanguage.mjs","utf8"); const duty=readFileSync("src/components/DutyTaskShell.tsx","utf8"); assert.match(language,/Tiếng Anh/); assert.match(language,/Tiếng Việt/); assert.match(duty,/isForeignReporter/); });

test("reporter job titles map language accounts",()=>{ const sql=readFileSync("supabase/migrations/20260822150000_reporter_language_job_titles.sql","utf8"); const duty=readFileSync("supabase/migrations/20260822130000_duty_vietnamese_reporters_only.sql","utf8"); for (const code of ["phong_vien_tieng_anh","phong_vien_tieng_trung","phong_vien_tieng_lao","phong_vien_tieng_khmer","phong_vien_tieng_nga"]) assert.match(sql,new RegExp(code)); assert.match(sql,/phong_vien_tieng_anh/); assert.match(duty,/thuphuong.*thithuy.*ngocanh/); });

test("online work supports multiple foreign reporters per date",()=>{const sql=readFileSync("supabase/migrations/20260822160000_online_work_multiple_staff.sql","utf8");const admin=readFileSync("src/components/OnlineWorkAdminShell.tsx","utf8");const viewer=readFileSync("src/components/OnlineWorkViewer.tsx","utf8");assert.match(sql,/online_work_schedules\(work_date,staff_id\)/);assert.match(sql,/primary key\(work_date,staff_id\)/);assert.match(sql,/staffIds/);assert.match(admin,/\+ Thêm người/);assert.match(viewer,/new Map<string,Row\[\]>/);assert.match(viewer,/assignments\.map/);});

test("online work month queries use the actual calendar month end",()=>{
  const repository=readFileSync("src/lib/onlineWorkRepository.ts","utf8");
  assert.doesNotMatch(repository,/\$\{month\}-31/);
  assert.match(repository,/lastDayOfMonth\(month\)/);
});

test("online work keeps the bounded viewer endpoint unchanged",()=>{
  const route=readFileSync("src/app/api/online-work-schedule/route.ts","utf8");
  assert.match(route,/MAX_RANGE_DAYS = 42/);
  assert.match(route,/onlineWorkRepository\.range\(from, to\)/);
});

test("online work rejects invalid month input with HTTP 400",()=>{
  const route=readFileSync("src/app/api/online-work/route.ts","utf8");
  assert.match(route,/const monthPattern = \/\^\\d\{4\}-\(0\[1-9\]\|1\[0-2\]\)\$\//);
  assert.match(route,/if \(!monthPattern\.test\(month\)\) return apiError\("invalid_request", 400\)/);
});
