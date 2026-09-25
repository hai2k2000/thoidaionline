export const REQUIRED_MIGRATIONS = [
  "20260924120000_task_approval_gates",
  "20260924130000_task_assignment_semantics",
  "20260924100000_attendance_reconciliation",
  "20260923110000_journalism_scope_hardening",
];

export function validateMigrationState(appliedVersions, expected = REQUIRED_MIGRATIONS) {
  const applied = new Set(appliedVersions ?? []);
  const missing = expected.filter((version) => !applied.has(version));
  return { ok: missing.length === 0, missing };
}
