export type DepartmentPlanContinuationRelation = "LONG_RUNNING" | "CARRY_OVER";

export type DepartmentPlanContinuationCandidate = {
  taskId?: string | null;
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  assigneeIds?: string[];
  dueDate?: string | null;
  dueTime?: string | null;
  status?: string | null;
  periodRelation?: string | null;
  periodGoal?: string | null;
  [key: string]: unknown;
};

const COMPLETED_TASK_STATUSES = new Set(["done", "completed", "cancelled", "rejected"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isActiveCanonicalTask = (candidate: Pick<DepartmentPlanContinuationCandidate, "taskId" | "status">) =>
  Boolean(candidate.taskId) && !COMPLETED_TASK_STATUSES.has(String(candidate.status ?? "").toLowerCase());

export const classifyDepartmentPlanContinuation = ({
  taskId,
  status,
  dueDate,
  periodEnd,
}: Pick<DepartmentPlanContinuationCandidate, "taskId" | "status" | "dueDate"> & { periodEnd: string }): DepartmentPlanContinuationRelation | null => {
  if (!isActiveCanonicalTask({ taskId, status }) || !ISO_DATE.test(periodEnd)) return null;
  if (dueDate && ISO_DATE.test(dueDate) && dueDate > periodEnd) return "LONG_RUNNING";
  return "CARRY_OVER";
};

export const prepareDepartmentPlanContinuationCandidates = <T extends DepartmentPlanContinuationCandidate>(
  candidates: T[],
  periodEnd: string,
  existingTaskIds: Iterable<string> = [],
  sourcePeriodEnd = periodEnd,
) => {
  const existing = new Set(existingTaskIds);
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    if (!candidate.taskId || existing.has(candidate.taskId) || seen.has(candidate.taskId) || !isActiveCanonicalTask({ taskId: candidate.taskId, status: candidate.status })) return [];
    seen.add(candidate.taskId);
    const relation = candidate.previousItemId
      ? classifyDepartmentPlanContinuation({ taskId: candidate.taskId, status: candidate.status, dueDate: candidate.dueDate, periodEnd: sourcePeriodEnd })
      : candidate.periodRelation === "CARRY_OVER" || candidate.periodRelation === "LONG_RUNNING"
        ? candidate.periodRelation
        : classifyDepartmentPlanContinuation({ taskId: candidate.taskId, status: candidate.status, dueDate: candidate.dueDate, periodEnd });
    if (relation === "LONG_RUNNING" && !isActiveCanonicalTask({ taskId: candidate.taskId, status: candidate.status })) return [];
    return [{ ...candidate, periodRelation: relation ?? candidate.periodRelation ?? "NEW", periodGoal: candidate.periodGoal ?? null }];
  });
};
