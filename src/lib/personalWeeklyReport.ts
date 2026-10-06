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
    existing.sourceLabel = existing.sourceLabels[0];
    if (existing.source !== "department_plan" && source === "department_plan") existing.source = source;
    if (!existing.periodRelation) existing.periodRelation = relationOf(input) ?? null;
  }
  return result;
}

export function buildNextWeekCandidates(rows: readonly Record<string, unknown>[], nextPeriod: PersonalWeeklyPeriod): PersonalWeeklyNextRow[] {
  return dedupePersonalWeeklyTasks(rows)
    .filter((row) => continuationRelations.has(row.periodRelation ?? "") && !terminalStatuses.has(String(row.status ?? "").toLowerCase()))
    .map((row) => ({ ...row, period: { ...nextPeriod }, sourceLabels: [...row.sourceLabels] }));
}

export function validatePersonalWeeklyDraft(payload: unknown): { ok: true; value: PersonalWeeklyDraft } | { ok: false; message: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, message: "Draft payload must be an object" };
  const input = payload as Record<string, unknown>;
  const currentRows = Array.isArray(input.currentRows) ? input.currentRows : [];
  const nextRows = Array.isArray(input.nextRows) ? input.nextRows : [];
  if (currentRows.length > MAX_ROWS || nextRows.length > MAX_ROWS) return { ok: false, message: `Row count exceeds maximum of ${MAX_ROWS}` };
  const ids = new Set<string>();
  for (const row of [...currentRows, ...nextRows]) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false, message: "Rows must be objects" };
    const id = taskIdOf(row as Record<string, unknown>);
    if (id && ids.has(id)) return { ok: false, message: `Duplicate task ID: ${id}` };
    if (id) ids.add(id);
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
