import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const sql = readFileSync(new URL("../../supabase/migrations/20261003100000_department_period_plan_v2.sql", import.meta.url), "utf8");
const v2SourceFiles = [
  "src/components/DepartmentPlanActions.tsx",
  "src/components/DepartmentPlanShell.tsx",
  "src/components/DepartmentPlanGrid.tsx",
  "src/components/DepartmentPlanItemDialog.tsx",
  "src/components/DepartmentPlanItemFields.tsx",
  "src/components/DepartmentPlanAssignmentDialog.tsx",
  "src/components/DepartmentPlanQuickAssignDialog.tsx",
  "src/components/DepartmentPlanReport.tsx",
  "src/lib/departmentPlanExcel.mjs",
  "src/lib/departmentPlanDocx.ts",
  "src/lib/departmentPlanDocxExport.ts",
  "src/lib/departmentPlanPdf.ts",
];
const suspiciousMojibake = [/\u00c3/, /\u00e1\u00ba/, /\u00e1\u00bb/];
const requiredLabels = [
  "T\u1ea1o k\u1ebf ho\u1ea1ch k\u1ef3 m\u1edbi",
  "Import k\u1ebf ho\u1ea1ch t\u1eeb Excel",
  "Quay l\u1ea1i k\u1ebf ho\u1ea1ch k\u1ef3",
  "File Excel kh\u00f4ng h\u1ee3p l\u1ec7",
  "X\u00e1c nh\u1eadn import",
  "K\u1ebf ho\u1ea1ch tu\u1ea7n",
  "K\u1ebf ho\u1ea1ch th\u00e1ng",
  "T\u1ed5ng k\u1ebft k\u1ef3",
  "Tu\u1ea7n tr\u01b0\u1edbc",
  "Tu\u1ea7n sau",
  "Tu\u1ea7n n\u00e0y",
  "N\u1ed9i dung k\u1ebf ho\u1ea1ch",
  "Ng\u01b0\u1eddi th\u1ef1c hi\u1ec7n",
  "H\u1ea1n ho\u00e0n th\u00e0nh",
  "Tr\u1ea1ng th\u00e1i",
  "Th\u00eam d\u00f2ng",
  "Giao vi\u1ec7c",
  "Ch\u1ed1t k\u1ef3",
  "D\u00e0i h\u1ea1n",
  "Chuy\u1ec3n ti\u1ebfp",
  "\u0110\u1ecbnh k\u1ef3",
];
const readSource = (file) => readFileSync(join(process.cwd(), file), "utf8");
const assertNoMojibake = (label, text) => suspiciousMojibake.forEach((pattern) => assert.doesNotMatch(text, pattern, `${label} contains ${pattern}`));

test("Department Period Plan V2 migration keeps Task canonical and enforces Task x period", () => {
  assert.match(sql, /department_plan_items_task_period_uidx/);
  assert.match(sql, /unique index[\s\S]*department_plan_id,linked_task_id/i);
  assert.match(sql, /period_relation/);
  assert.match(sql, /api_department_plan_candidates_v2/);
  assert.match(sql, /api_create_department_plan_v2/);
  assert.match(sql, /api_close_department_plan_v2/);
  assert.match(sql, /tasks_auto_link_department_plans/);
});

test("Department Period Plan V2 does not auto-link REPORT_ONLY or pending approval", () => {
  assert.match(sql, /workflow_type,'STANDARD'\)='REPORT_ONLY'/);
  assert.match(sql, /approval_required,false\) and new\.assignment_approved_at is null/);
});

test("Excel import is preview-only and DOCX export still uses real report rows", () => {
  const importRoute = readFileSync(new URL("../../src/app/api/planning/department/import/route.ts", import.meta.url), "utf8");
  const exportRoute = readFileSync(new URL("../../src/app/api/planning/department/reports/docx/route.ts", import.meta.url), "utf8");
  assert.match(importRoute, /persisted: false/);
  assert.match(importRoute, /readDepartmentPlanExcel/);
  assert.doesNotMatch(importRoute, /parseDepartmentPlanDocx/);
  assert.match(exportRoute, /exportDepartmentPlanDocx/);
});

test("Department Period Plan V2 Vietnamese source stays UTF-8 clean", () => {
  const source = v2SourceFiles.map((file) => readSource(file)).join("\n");
  assertNoMojibake("Department Period Plan V2 source", source);
  requiredLabels.forEach((label) => assert.ok(source.includes(label), `Missing Vietnamese label: ${label}`));
});

test("Department Period Plan V2 client bundle stays UTF-8 clean", { skip: process.env.CHECK_DEPARTMENT_PLAN_BUNDLE !== "1" }, () => {
  const manifestPath = join(process.cwd(), ".next/server/app/planning/department/page_client-reference-manifest.js");
  assert.ok(existsSync(manifestPath), "Department Plan client manifest is missing");
  const chunkDir = join(process.cwd(), ".next/static/chunks/app/planning/department");
  const entry = existsSync(chunkDir) ? readdirSync(chunkDir).filter((file) => file.endsWith(".js")).map((file) => join(chunkDir, file)) : [];
  assert.ok(entry.length > 0, "Department Plan client entry chunks are missing");
  const bundle = entry.map((chunk) => readFileSync(chunk, "utf8")).join("\n");
  assertNoMojibake("Department Period Plan V2 client bundle", bundle);
  assert.ok(bundle.includes("T\u1ea1o k\u1ebf ho\u1ea1ch k\u1ef3 m\u1edbi"));
  assert.ok(bundle.includes("Import k\u1ebf ho\u1ea1ch t\u1eeb Excel"));
});
