export const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const WEIGHT_OPTIONS = [1, 2, 3, 5, 8] as const;

export type CompletionLevel = "not_done" | "done" | "excellent";

export type EvaluationAccess = {
  roleCode?: string | null;
  canManageUsers?: boolean;
};

export type TaskEvaluationInput = {
  rating: number;
  effortWeight: number;
  completion: CompletionLevel;
  onTime: boolean;
  opinion?: string | null;
  checkpointDate: string;
  isFinal: boolean;
};

export type TaskEvaluationRow = {
  id: string;
  task_id: string;
  employee_id: string;
  reviewer_id?: string | null;
  rating: number;
  effort_weight: number;
  completion?: CompletionLevel;
  on_time?: boolean;
  opinion?: string | null;
  checkpoint_date: string;
  is_final: boolean;
  created_at: string;
};

export type EvaluationTask = {
  id: string;
  status: string;
};

export const canEditTaskEvaluation = ({ roleCode, canManageUsers }: EvaluationAccess) =>
  roleCode === "tong_bien_tap" || canManageUsers === true;

export function normalizeEvaluationInput(input: TaskEvaluationInput & Record<string, unknown>): TaskEvaluationInput {
  if (!RATING_OPTIONS.includes(input.rating as (typeof RATING_OPTIONS)[number])) {
    throw new RangeError("Điểm đánh giá phải từ 1 đến 10.");
  }
  if (!WEIGHT_OPTIONS.includes(input.effortWeight as (typeof WEIGHT_OPTIONS)[number])) {
    throw new RangeError("Trọng số công việc không hợp lệ.");
  }
  if (!["not_done", "done", "excellent"].includes(input.completion)) {
    throw new RangeError("Mức hoàn thành không hợp lệ.");
  }

  return {
    rating: input.rating,
    effortWeight: input.effortWeight,
    completion: input.completion,
    onTime: input.onTime,
    opinion: input.opinion?.trim() || null,
    checkpointDate: input.checkpointDate,
    isFinal: input.isFinal,
  };
}

const evaluationTimestamp = (row: TaskEvaluationRow) =>
  `${row.checkpoint_date}T${row.created_at}`;

export function selectLatestFinalEvaluations(rows: TaskEvaluationRow[]) {
  const latest = new Map<string, TaskEvaluationRow>();

  for (const row of rows) {
    if (!row.is_final) continue;
    const key = `${row.employee_id}:${row.task_id}`;
    const current = latest.get(key);
    if (!current || evaluationTimestamp(row) > evaluationTimestamp(current)) latest.set(key, row);
  }

  return [...latest.values()];
}

export function summarizeEmployeeEvaluation({
  tasks,
  evaluations,
  employeeId,
}: {
  tasks: EvaluationTask[];
  evaluations: TaskEvaluationRow[];
  employeeId: string;
}) {
  const uniqueTasks = [...new Map(tasks.map((task) => [task.id, task])).values()];
  const taskIds = new Set(uniqueTasks.map((task) => task.id));
  const finalEvaluations = selectLatestFinalEvaluations(evaluations).filter(
    (row) => row.employee_id === employeeId && taskIds.has(row.task_id),
  );
  const totalWeight = finalEvaluations.reduce((sum, row) => sum + row.effort_weight, 0);
  const weightedPoints = finalEvaluations.reduce((sum, row) => sum + row.rating * row.effort_weight, 0);

  return {
    taskCount: uniqueTasks.length,
    completedCount: uniqueTasks.filter((task) => task.status === "done").length,
    notCompletedCount: uniqueTasks.filter((task) => task.status !== "done").length,
    totalWeight,
    weightedPoints,
    weightedAverage: totalWeight > 0 ? weightedPoints / totalWeight : 0,
    finalEvaluations,
  };
}

export const taskDetailUrl = (taskId: string) => `/tasks/${taskId}`;