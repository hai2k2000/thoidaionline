export const REQUIRED_MIGRATIONS = [
  "20260924120000_task_approval_gates",
  "20260924130000_task_assignment_semantics",
  "20260924100000_attendance_reconciliation",
  "20260923110000_journalism_scope_hardening",
  "20260926140000_department_plans_v2",
  "20260926150000_department_plan_to_task_v1",
];

export function validateMigrationState(appliedVersions, expected = REQUIRED_MIGRATIONS) {
  const applied = new Set(appliedVersions ?? []);
  const missing = expected.filter((version) => !applied.has(version));
  return { ok: missing.length === 0, missing };
}
