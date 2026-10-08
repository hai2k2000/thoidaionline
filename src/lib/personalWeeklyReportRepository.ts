/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import {
  buildNextWeekCandidates,
  dedupePersonalWeeklyTasks,
  personalWeeklyPeriod,
  type PersonalWeeklyCurrentRow,
  type PersonalWeeklyNextRow,
  type PersonalWeeklyPeriod,
  type PersonalWeeklyReportVersion,
  type PersonalWeeklyReopenEligibility,
  boundPersonalWeeklyVersions,
  buildPersonalWeeklyReopenRpcArgs,
  personalWeeklyReopenEligibility,
} from "@/lib/personalWeeklyReport";
import { workScheduleRepository } from "@/lib/workScheduleRepository";

export type PersonalWeeklyReportRow = {
  id: string;
  employee_id: string;
  department_id: string;
  period_start: string;
  period_end: string;
  status: "DRAFT" | "COMPLETED";
  draft_payload: Record<string, unknown>;
  snapshot_payload: Record<string, unknown> | null;
  difficulties: string;
  completed_at: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type PersonalWeeklyProposal = Record<string, unknown> & {
  id?: string;
  title?: string | null;
  approval_status?: string | null;
};

export type PersonalWeeklyReportLoad = {
  period: { current: PersonalWeeklyPeriod; next: PersonalWeeklyPeriod };
  employee: Record<string, unknown> | null;
  report: PersonalWeeklyReportRow | null;
  currentReport: PersonalWeeklyReportRow | null;
  history: PersonalWeeklyReportRow[];
  currentRows: PersonalWeeklyCurrentRow[];
  nextRows: PersonalWeeklyNextRow[];
  proposals: PersonalWeeklyProposal[];
  difficulties: string;
  historical: boolean;
  versions: PersonalWeeklyReportVersion[];
  currentVersionNo: number | null;
  reopenEligibility: PersonalWeeklyReopenEligibility;
};

type Db = typeof serverSupabase;

export const PERSONAL_WEEKLY_HISTORY_LIMIT = 12;

const taskFields = [
  "id,title,status,workflow_type,assignment_source,department_id,start_date,due_date,completed_at,description,report_notes,report_work_date,assignee_id,owner_id,recurrence_rule_id",
  "departments(name)",
  "owner:staff_users!tasks_owner_id_fkey(full_name)",
  "assignee:staff_users!tasks_assignee_id_fkey(full_name)",
  "task_assignees(user_id,assignment_role,status,staff_users(full_name))",
  "recurrence_rule:task_recurrence_rules(active,starts_on,ends_on,next_scheduled_for)",
  "department_plan_items!department_plan_items_linked_task_id_fkey(id,period_relation,carry_forward,department_plan_id)",
].join(",");

const asArray = <T>(value: T | T[] | null | undefined): T[] => value == null ? [] : Array.isArray(value) ? value : [value];

function errorOrThrow(result: { error?: any | null }) {
  if (result.error) throw result.error;
}

function relationFor(task: any, links: any[]): string | null {
  const link = links.find((item) => item.period_relation || item.carry_forward);
  return link?.period_relation ?? task.period_relation ?? (link?.carry_forward ? "CARRY_OVER" : null)
    ?? (task.recurrence_rule_id ? "RECURRING" : null);
}

function taskDateInPeriod(task: any, period: PersonalWeeklyPeriod): boolean {
  if (task.workflow_type === "REPORT_ONLY") {
    return typeof task.report_work_date === "string"
      && task.report_work_date >= period.start && task.report_work_date < period.end;
  }
  const start = typeof task.start_date === "string" ? task.start_date : null;
  const due = typeof task.due_date === "string" ? task.due_date : null;
  return Boolean((start && start < period.end && (!due || due >= period.start))
    || (due && due >= period.start && due < period.end));
}

function actorParticipates(task: any, actorId: string): boolean {
  if (task.owner_id === actorId || task.assignee_id === actorId) return true;
  return asArray(task.task_assignees).some((assignment: any) =>
    assignment?.user_id === actorId && String(assignment.assignment_role ?? "").toLowerCase() !== "watcher"
      && String(assignment.status ?? "active").toLowerCase() !== "removed");
}

function taskRows(tasks: any[], actorId: string, period: PersonalWeeklyPeriod): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const task of tasks) {
    if (!actorParticipates(task, actorId) || task.status === "cancelled" || !taskDateInPeriod(task, period)) continue;
    const links = asArray(task.department_plan_items);
    const base = {
      taskId: task.id,
      title: task.title,
      status: task.status,
      workflowType: task.workflow_type,
      workflow_type: task.workflow_type,
      startDate: task.start_date,
      dueDate: task.due_date,
      reportWorkDate: task.report_work_date,
      departmentId: task.department_id,
      departmentName: task.departments?.name ?? null,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee?.full_name ?? null,
      ownerId: task.owner_id,
      recurrenceRule: task.recurrence_rule ?? null,
      source: task.workflow_type === "REPORT_ONLY" ? "report_only" : "assigned",
      periodRelation: relationFor(task, links),
    };
    rows.push(base);
    if (links.length > 0 && task.workflow_type !== "REPORT_ONLY") {
      for (const link of links) rows.push({ ...base, source: "department_plan", periodRelation: link.period_relation ?? (link.carry_forward ? "CARRY_OVER" : base.periodRelation), departmentPlanItemId: link.id, departmentPlanId: link.department_plan_id, departmentPlanName: link.department_plans?.name ?? null });
    }
  }
  return rows;
}

async function getEmployee(db: Db, actorId: string) {
  const result = await db.from("staff_users")
    .select("id,full_name,department_id,job_title_id,job_titles(name),departments!staff_users_department_id_fkey(name)")
    .eq("id", actorId).eq("active", true).maybeSingle();
  errorOrThrow(result);
  return result.data as Record<string, unknown> | null;
}

async function getCurrentReport(db: Db, actorId: string, period: PersonalWeeklyPeriod) {
  const result = await db.from("personal_weekly_reports").select("*")
    .eq("employee_id", actorId).eq("period_start", period.start).eq("period_end", period.end).maybeSingle();
  errorOrThrow(result);
  return result.data as PersonalWeeklyReportRow | null;
}

async function verifiedAdmin(db: Db, actorId: string): Promise<boolean> {
  const result = await db.from("staff_users")
    .select("roles(code,role_permissions(can_manage_rubrics))")
    .eq("id", actorId).eq("active", true).maybeSingle();
  errorOrThrow(result);
  const roles = result.data?.roles as any;
  const permission = roles?.role_permissions;
  const permissions = Array.isArray(permission) ? permission : permission ? [permission] : [];
  return roles?.code === "admin" && permissions.some((item: any) => item?.can_manage_rubrics === true);
}

async function getHistoricalReport(db: Db, actorId: string, reportId: string) {
  const isAdmin = await verifiedAdmin(db, actorId);
  let query = db.from("personal_weekly_reports").select("*").eq("id", reportId).eq("status", "COMPLETED");
  if (!isAdmin) query = query.eq("employee_id", actorId);
  const result = await query.maybeSingle();
  errorOrThrow(result);
  if (!result.data) throw Object.assign(new Error("weekly report not found"), { code: "P0002" });
  return result.data as PersonalWeeklyReportRow;
}

async function getHistory(db: Db, actorId: string) {
  const result = await db.from("personal_weekly_reports").select("*")
    .eq("employee_id", actorId)
    .order("period_start", { ascending: false })
    .order("period_end", { ascending: false })
    .limit(PERSONAL_WEEKLY_HISTORY_LIMIT);
  errorOrThrow(result);
  return ((result.data ?? []) as PersonalWeeklyReportRow[]);
}

async function getVersions(db: Db, actorId: string, reportId: string): Promise<PersonalWeeklyReportVersion[]> {
  const isAdmin = await verifiedAdmin(db, actorId);
  let parentQuery = db.from("personal_weekly_reports").select("id").eq("id", reportId);
  if (!isAdmin) parentQuery = parentQuery.eq("employee_id", actorId);
  const parent = await parentQuery.maybeSingle();
  errorOrThrow(parent);
  if (!parent.data) throw Object.assign(new Error("weekly report not found"), { code: "P0002" });
  const result = await db.from("personal_weekly_report_versions").select("*")
    .eq("report_id", reportId).order("version_no", { ascending: false }).limit(PERSONAL_WEEKLY_HISTORY_LIMIT);
  errorOrThrow(result);
  return boundPersonalWeeklyVersions((result.data ?? []) as PersonalWeeklyReportVersion[], PERSONAL_WEEKLY_HISTORY_LIMIT);
}

async function getCanonicalRows(db: Db, actorId: string, period: PersonalWeeklyPeriod) {
  const query = db.from("tasks").select(taskFields)
    .or(`start_date.lt.${period.end},report_work_date.lt.${period.end}`)
    .or(`due_date.gte.${period.start},report_work_date.gte.${period.start}`)
    .neq("status", "cancelled").limit(2000);
  const result = await query;
  errorOrThrow(result);
  return dedupePersonalWeeklyTasks(taskRows((result.data ?? []) as any[], actorId, period));
}

async function getProposals(actorId: string, period: PersonalWeeklyPeriod) {
  const result = await workScheduleRepository.listPersonal(period.start, period.end, actorId);
  if (!result.ok) throw result.error;
  return (result.rows as PersonalWeeklyProposal[]).filter((row) =>
    row.schedule_scope === "personal" || row.schedule_scope == null,
  );
}

function snapshotRows(report: PersonalWeeklyReportRow) {
  const snapshot = report.snapshot_payload ?? {};
  return {
    currentRows: Array.isArray(snapshot.currentRows) ? snapshot.currentRows as PersonalWeeklyCurrentRow[] : [],
    nextRows: Array.isArray(snapshot.nextRows) ? snapshot.nextRows as PersonalWeeklyNextRow[] : [],
    proposals: Array.isArray(snapshot.proposals) ? snapshot.proposals as PersonalWeeklyProposal[] : [],
    employee: snapshot.employee && typeof snapshot.employee === "object" ? snapshot.employee as Record<string, unknown> : null,
    difficulties: typeof snapshot.difficulties === "string" ? snapshot.difficulties : report.difficulties,
  };
}

export async function getPersonalWeeklyReport(
  actorId: string,
  period: { current: PersonalWeeklyPeriod; next: PersonalWeeklyPeriod } | PersonalWeeklyPeriod,
  dependencies: { db?: Db; reportId?: string } = {},
): Promise<PersonalWeeklyReportLoad> {
  const db = dependencies.db ?? serverSupabase;
  if (dependencies.reportId) {
    const report = await getHistoricalReport(db, actorId, dependencies.reportId);
    const frozen = snapshotRows(report);
    const reportPeriod = { start: report.period_start, end: report.period_end };
    const periods = { current: reportPeriod, next: personalWeeklyPeriod(report.period_start).next };
    const versions = await getVersions(db, actorId, report.id);
    const isAdmin = await verifiedAdmin(db, actorId);
    return { period: periods, employee: frozen.employee, report, currentReport: report, history: await getHistory(db, actorId), currentRows: frozen.currentRows, nextRows: frozen.nextRows, proposals: frozen.proposals, difficulties: frozen.difficulties, historical: true, versions, currentVersionNo: versions[0]?.version_no ?? null, reopenEligibility: personalWeeklyReopenEligibility(report, actorId, isAdmin) };
  }
  const periods = "current" in period ? period : personalWeeklyPeriod(period.start);
  const [employee, report, history] = await Promise.all([
    getEmployee(db, actorId),
    getCurrentReport(db, actorId, periods.current),
    getHistory(db, actorId),
  ]);
  if (!employee) {
    const error = Object.assign(new Error("employee not found"), { code: "42501" });
    throw error;
  }
  if (report?.status === "COMPLETED") {
    const frozen = snapshotRows(report);
    const versions = await getVersions(db, actorId, report.id);
    const isAdmin = await verifiedAdmin(db, actorId);
    return { period: periods, employee: frozen.employee, report, currentReport: report, history, currentRows: frozen.currentRows, nextRows: frozen.nextRows, proposals: frozen.proposals, difficulties: frozen.difficulties, historical: false, versions, currentVersionNo: versions[0]?.version_no ?? null, reopenEligibility: personalWeeklyReopenEligibility(report, actorId, isAdmin) };
  }
  const currentRows = await getCanonicalRows(db, actorId, periods.current);
  const nextRows = buildNextWeekCandidates(currentRows, periods.next);
  const proposals = await getProposals(actorId, periods.next);
  const versions = report ? await getVersions(db, actorId, report.id) : [];
  const isAdmin = report ? await verifiedAdmin(db, actorId) : false;
  return { period: periods, employee, report, currentReport: report, history, currentRows, nextRows, proposals, difficulties: report?.difficulties ?? "", historical: false, versions, currentVersionNo: versions[0]?.version_no ?? null, reopenEligibility: personalWeeklyReopenEligibility(report, actorId, isAdmin) };
}

export type PersonalWeeklyMutationInput = {
  period: PersonalWeeklyPeriod;
  draftPayload: Record<string, unknown>;
  difficulties: string;
};

export async function savePersonalWeeklyDraft(actorId: string, input: PersonalWeeklyMutationInput, dependencies: { db?: Db } = {}) {
  const db = dependencies.db ?? serverSupabase;
  const result = await db.rpc("api_save_personal_weekly_report", {
    p_actor: actorId,
    p_employee: actorId,
    p_period_start: input.period.start,
    p_period_end: input.period.end,
    p_draft_payload: input.draftPayload,
    p_difficulties: input.difficulties,
  });
  return result.error ? { ok: false as const, error: result.error } : { ok: true as const, data: result.data as PersonalWeeklyReportRow };
}

export async function completePersonalWeeklyReport(actorId: string, input: PersonalWeeklyMutationInput, dependencies: { db?: Db } = {}) {
  const db = dependencies.db ?? serverSupabase;
  const result = await db.rpc("api_complete_personal_weekly_report", {
    p_actor: actorId,
    p_employee: actorId,
    p_period_start: input.period.start,
    p_period_end: input.period.end,
    p_snapshot_payload: input.draftPayload,
    p_difficulties: input.difficulties,
  });
  return result.error ? { ok: false as const, error: result.error } : { ok: true as const, data: result.data as PersonalWeeklyReportRow };
}

export async function reopenPersonalWeeklyReport(actorId: string, reportId: string, reason: string, dependencies: { db?: Db } = {}) {
  const db = dependencies.db ?? serverSupabase;
  const result = await db.rpc("api_reopen_personal_weekly_report", buildPersonalWeeklyReopenRpcArgs(actorId, reportId, reason));
  return result.error ? { ok: false as const, error: result.error } : { ok: true as const, data: result.data as PersonalWeeklyReportRow };
}

export async function listPersonalWeeklyReportVersions(actorId: string, reportId: string, dependencies: { db?: Db } = {}) {
  return getVersions(dependencies.db ?? serverSupabase, actorId, reportId);
}
