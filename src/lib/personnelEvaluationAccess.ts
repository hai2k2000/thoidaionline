export type PersonnelEvaluationAction = "manager" | "tbt" | null;

export function resolvePersonnelEvaluationAction(input: {
  directTbtEnabled: boolean;
  roleCode: string;
  canEvaluateStep2: boolean;
  reviewStatus: string | null;
  hasTbtScore: boolean;
  rpcAction: PersonnelEvaluationAction;
}): PersonnelEvaluationAction {
  if (input.directTbtEnabled && input.roleCode === "tong_bien_tap" && input.canEvaluateStep2 && !input.hasTbtScore
    && (input.reviewStatus === "awaiting_manager" || input.reviewStatus === "awaiting_tbt")) {
    return "tbt";
  }
  return input.rpcAction;
}
