export const REQUIRED_TABLE_COLUMNS = {
  tasks: ["approval_required", "assignment_source", "status", "created_by", "owner_id"],
  journalism_task_details: ["task_id", "publication_status", "planned_publication_at", "editorial_notes"],
  work_schedules: ["id", "work_date", "status", "workflow_revision"],
  attendance_logs: ["user_id", "work_date", "check_in", "check_out"],
};

export const REQUIRED_TABLES = Object.keys(REQUIRED_TABLE_COLUMNS).concat(["task_status_events", "audit_logs"]);
export const REQUIRED_RPCS = [
  "api_create_personal_work_schedule",
  "api_review_personal_work_schedule",
  "api_merge_attendance_log",
  "api_reconcile_journalism_publication_report_v1",
];
export const REQUIRED_STATUS_VALUES = ["waiting", "in_progress", "pending_review", "done", "rejected", "cancelled"];

export function validateSchemaSnapshot(snapshot) {
  const tables = new Set(snapshot?.tables ?? []);
  const columns = snapshot?.columns ?? {};
  const functions = new Set(snapshot?.functions ?? []);
  const statuses = new Set(snapshot?.taskStatuses ?? []);
  const missingTables = REQUIRED_TABLES.filter((table) => !tables.has(table));
  const missingColumns = Object.fromEntries(Object.entries(REQUIRED_TABLE_COLUMNS).flatMap(([table, required]) => {
    const missing = required.filter((column) => !new Set(columns[table] ?? []).has(column));
    return missing.length ? [[table, missing]] : [];
  }));
  const missingFunctions = REQUIRED_RPCS.filter((rpc) => !functions.has(rpc));
  const missingStatuses = REQUIRED_STATUS_VALUES.filter((status) => !statuses.has(status));
  return { ok: !missingTables.length && !Object.keys(missingColumns).length && !missingFunctions.length && !missingStatuses.length, missingTables, missingColumns, missingFunctions, missingStatuses };
}
