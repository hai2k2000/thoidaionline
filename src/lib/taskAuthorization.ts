import type { RbacActor, RbacTaskResource } from "./rbac/types";

export type TaskAuthorizationDecision = {
  legacyAllowed: boolean;
  rbacBaseAllowed: boolean;
  workflowAllowed: boolean;
  finalAllowed: boolean;
};

const WORKFLOW_BASE_ACTIONS = new Set([
  "submit", "return", "resubmit", "approve", "score", "rescore", "update",
  "deadline", "cancel", "reopen", "attachment", "report", "complete_assigned",
  "review", "assigned_cancel", "claim", "personal_edit", "personal_deadline",
  "personal_cancel", "personal_complete",
]);

export function taskBasePermission(action: string, roleCode?: string): string {
  if (action === "comment") return "task.comment";
  if (action === "assign") return "task.assign";
  if (action === "create" || action === "personal_create") return "task.create";
  if (action === "admin_edit") return "task.edit_all";
  if (action === "evaluate") return "task.evaluate.step1";
  if (action === "leader_evaluate") {
    return roleCode === "tong_bien_tap" ? "task.evaluate.step2" : "task.evaluate.step1";
  }
  if (action === "view" || WORKFLOW_BASE_ACTIONS.has(action)) return "task.view";
  return "task.view";
}

export function parseTaskRbacEnabled(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

export const parseTaskRbacV2Enabled = parseTaskRbacEnabled;

export function decideTaskAuthorization(input: {
  enabled: boolean;
  legacyAllowed: boolean;
  rbacBaseAllowed: boolean;
  workflowAllowed?: boolean;
}): TaskAuthorizationDecision {
  const workflowAllowed = input.workflowAllowed ?? input.legacyAllowed;
  const finalAllowed = input.enabled
    ? input.rbacBaseAllowed && workflowAllowed
    : input.legacyAllowed;
  return {
    legacyAllowed: input.legacyAllowed,
    rbacBaseAllowed: input.rbacBaseAllowed,
    workflowAllowed,
    finalAllowed,
  };
}

export function canTaskBase(
  actor: RbacActor,
  permission: string,
  resource?: RbacTaskResource,
): boolean {
  const scopes = actor.grants
    .filter((grant) => grant.permissionCode === permission)
    .map((grant) => grant.scope);
  if (scopes.length === 0) return false;
  if (!resource) return true;
  return scopes.some((scope) => {
    if (scope === "all") return true;
    if (scope === "self") return resource.createdBy === actor.id || resource.ownerId === actor.id;
    if (scope === "assigned") {
      return [resource.createdBy, resource.ownerId, resource.assigneeId, resource.reviewerId].includes(actor.id)
        || resource.participantIds?.includes(actor.id) === true;
    }
    return actor.departmentId !== null && resource.departmentId === actor.departmentId;
  });
}

export function buildTaskListScope(
  actor: RbacActor,
  taskIds: readonly string[],
): { all: boolean; terms: string[] } {
  const grants = actor.grants.filter((grant) => grant.permissionCode === "task.view");
  if (grants.some((grant) => grant.scope === "all")) return { all: true, terms: [] };
  const terms: string[] = [];
  const scopes = new Set(grants.map((grant) => grant.scope));
  if (scopes.has("self") || scopes.has("assigned")) terms.push(`created_by.eq.${actor.id}`);
  if (scopes.has("self")) terms.push(`owner_id.eq.${actor.id}`);
  if (scopes.has("assigned")) {
    terms.push(`owner_id.eq.${actor.id}`, `assignee_id.eq.${actor.id}`, `reviewer_id.eq.${actor.id}`);
  }
  if (scopes.has("department")) terms.push(`department_id.eq.${actor.departmentId}`);
  if (taskIds.length > 0 && scopes.has("assigned")) terms.push(`id.in.(${taskIds.join(",")})`);
  return { all: false, terms: [...new Set(terms)] };
}
