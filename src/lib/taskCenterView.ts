export type TaskCenterView = "work" | "evaluations";

export function resolveTaskCenterView(
  requested: string | string[] | undefined,
  canViewEvaluations: boolean,
): TaskCenterView {
  if (requested === "evaluations" && canViewEvaluations) {
    return "evaluations";
  }
  return "work";
}
