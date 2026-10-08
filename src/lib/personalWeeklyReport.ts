// @ts-expect-error Node contract tests execute this TypeScript module directly and need the explicit extension.
import { getDepartmentPlanPeriod } from "./departmentPlanPeriod.ts";

export type PersonalWeeklySource = "assigned" | "department_plan" | "report_only" | string;
export type PersonalWeeklyPeriod = { start: string; end: string };

export type PersonalWeeklyCurrentRow = {
  taskId: string;
  title?: string | null;
  status?: string | null;
  source: PersonalWeeklySource;
  sourceLabel: string;
  sourceLabels: string[];
  periodRelation?: string | null;
  workflowType?: string | null;
  [key: string]: unknown;
};

export type PersonalWeeklySnapshot = {
  employee?: Record<string, unknown> | null;
  period?: PersonalWeeklyPeriod;
  currentRows?: PersonalWeeklyCurrentRow[];
  nextRows?: PersonalWeeklyNextRow[];
  proposals?: Record<string, unknown>[];
  difficulties?: string;
};

export type PersonalWeeklyReportVersion = {
  id: string;
  report_id: string;
  version_no: number;
  employee_id: string;
  department_id: string;
  period_start: string;
  period_end: string;
  snapshot_payload: Record<string, unknown>;
  difficulties: string;
  completed_by: string;
  completed_at: string;
  created_at: string;
};

export type PersonalWeeklyReopenEligibility = {
  eligible: boolean | null;
  reason: "available" | "already_draft" | "expired" | "forbidden" | "not_completed" | "unknown";
  isAdmin: boolean;
};

export function normalizePersonalWeeklyReopenReason(reason: unknown): { ok: true; value: string } | { ok: false; code: "22023" } {
  const value = typeof reason === "string" ? reason.trim() : "";
  return value.length >= 5 && value.length <= 500 ? { ok: true, value } : { ok: false, code: "22023" };
}

export function buildPersonalWeeklyReopenRpcArgs(actorId: string, reportId: string, reason: string) {
  return { p_actor: actorId, p_report_id: reportId, p_reason: reason };
}

export function boundPersonalWeeklyVersions<T extends { version_no: number }>(versions: readonly T[], limit = 12): T[] {
  return [...versions].sort((a, b) => b.version_no - a.version_no).slice(0, limit);
}

export function personalWeeklyReopenEligibility(report: { status: string; employee_id: string } | null, actorId: string, isAdmin: boolean): PersonalWeeklyReopenEligibility {
  if (!report || report.status !== "COMPLETED") return { eligible: false, reason: "not_completed", isAdmin };
  if (isAdmin) return { eligible: true, reason: "available", isAdmin: true };
  if (report.employee_id !== actorId) return { eligible: false, reason: "forbidden", isAdmin: false };
  return { eligible: null, reason: "unknown", isAdmin: false };
}

export type PersonalWeeklyNextRow = PersonalWeeklyCurrentRow & {
  period: PersonalWeeklyPeriod;
};

export type PersonalWeeklyDraft = {
  currentRows: PersonalWeeklyCurrentRow[];
  nextRows: PersonalWeeklyNextRow[];
  difficulties: string;
  [key: string]: unknown;
};

const MAX_ROWS = 200;
const sourceNames: Record<string, string> = {
  assigned: "Công việc được giao",
  department_plan: "Kế hoạch phòng ban",
  report_only: "Việc phát sinh",
};
const continuationRelations = new Set(["LONG_RUNNING", "CARRY_OVER", "RECURRING"]);
const terminalStatuses = new Set(["done", "cancelled"]);

const value = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  return undefined;
};

const taskIdOf = (row: Record<string, unknown>) => {
  const id = value(row, "taskId", "task_id", "id");
  return typeof id === "string" && id.length > 0 ? id : null;
};

const sourceOf = (row: Record<string, unknown>) => {
  const workflow = value(row, "workflowType", "workflow_type");
  if (workflow === "REPORT_ONLY") return "report_only";
  return String(value(row, "source", "sourceType", "assignment_source") ?? "assigned");
};

const relationOf = (row: Record<string, unknown>) => value(row, "periodRelation", "period_relation") as string | undefined;

export function personalWeeklyPeriod(anchor?: string | null): { current: PersonalWeeklyPeriod; next: PersonalWeeklyPeriod } {
  const current = getDepartmentPlanPeriod("weekly", anchor ?? null);
  const next = getDepartmentPlanPeriod("weekly", current.periodEnd);
  return {
    current: { start: current.periodStart, end: current.periodEnd },
    next: { start: next.periodStart, end: next.periodEnd },
  };
}

export function dedupePersonalWeeklyTasks(rows: readonly Record<string, unknown>[]): PersonalWeeklyCurrentRow[] {
  const result: PersonalWeeklyCurrentRow[] = [];
  const byId = new Map<string, PersonalWeeklyCurrentRow>();
  for (const input of rows) {
    const taskId = taskIdOf(input);
    if (!taskId) continue;
    const source = sourceOf(input);
    const label = sourceNames[source] ?? String(value(input, "sourceLabel", "source_label") ?? source);
    const existing = byId.get(taskId);
    if (!existing) {
      const row = { ...input, taskId, source, sourceLabel: label, sourceLabels: [label], periodRelation: relationOf(input), workflowType: value(input, "workflowType", "workflow_type") } as PersonalWeeklyCurrentRow;
      byId.set(taskId, row);
      result.push(row);
      continue;
    }
    if (!existing.sourceLabels.includes(label)) existing.sourceLabels.push(label);
    // Merge non-empty relation/display fields without changing canonical task data.
    for (const [key, item] of Object.entries(input)) if (value(existing, key) === undefined && item !== undefined && item !== null && item !== "") existing[key] = item;
    if (source === "department_plan" && existing.source !== "department_plan") {
      existing.source = source;
      existing.sourceLabels = [label, ...existing.sourceLabels.filter((item) => item !== label)];
    }
    existing.sourceLabel = existing.source === "department_plan" ? sourceNames.department_plan : existing.sourceLabels[0];
    if (!existing.periodRelation) existing.periodRelation = relationOf(input) ?? null;
  }
  return result;
}

export function buildNextWeekCandidates(rows: readonly Record<string, unknown>[], nextPeriod: PersonalWeeklyPeriod): PersonalWeeklyNextRow[] {
  return dedupePersonalWeeklyTasks(rows)
    .filter((row) => {
      if (!continuationRelations.has(row.periodRelation ?? "") || terminalStatuses.has(String(row.status ?? "").toLowerCase())) return false;
      if (row.periodRelation !== "RECURRING") return true;
      const rule = (row.recurrenceRule ?? row.recurrence_rule) as Record<string, unknown> | null | undefined;
      if (!rule || rule.active !== true || typeof rule.next_scheduled_for !== "string") return false;
      const scheduled = rule.next_scheduled_for;
      return scheduled >= nextPeriod.start && scheduled < nextPeriod.end
        && typeof rule.starts_on === "string" && rule.starts_on <= scheduled
        && (typeof rule.ends_on !== "string" || rule.ends_on >= scheduled);
    })
    .map((row) => ({ ...row, period: { ...nextPeriod }, sourceLabels: [...row.sourceLabels] }));
}

export function validatePersonalWeeklyDraft(payload: unknown): { ok: true; value: PersonalWeeklyDraft } | { ok: false; message: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, message: "Draft payload must be an object" };
  const input = payload as Record<string, unknown>;
  const currentRows = Array.isArray(input.currentRows) ? input.currentRows : [];
  const nextRows = Array.isArray(input.nextRows) ? input.nextRows : [];
  if (currentRows.length > MAX_ROWS || nextRows.length > MAX_ROWS) return { ok: false, message: `Row count exceeds maximum of ${MAX_ROWS}` };
  for (const rows of [currentRows, nextRows]) {
    const ids = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false, message: "Rows must be objects" };
      const id = taskIdOf(row as Record<string, unknown>);
      if (!id) return { ok: false, message: "Rows require a task ID" };
      if (ids.has(id)) return { ok: false, message: `Duplicate task ID: ${id}` };
      ids.add(id);
    }
  }
  return {
    ok: true,
    value: {
      ...input,
      currentRows: dedupePersonalWeeklyTasks(currentRows as Record<string, unknown>[]),
      nextRows: nextRows.map((candidate) => {
        const inputRow = candidate as Record<string, unknown>;
        const id = taskIdOf(inputRow);
        if (!id) return inputRow as PersonalWeeklyNextRow;
        const [row] = dedupePersonalWeeklyTasks([inputRow]);
        return { ...row, period: (inputRow.period as PersonalWeeklyPeriod | undefined) ?? { start: "", end: "" } };
      }),
      difficulties: typeof input.difficulties === "string" ? input.difficulties : "",
    },
  };
}
