import type { PermissionSet } from "./permissions";
import { isLeadershipAssignmentReviewer } from "./taskReviewerPolicy.mjs";

export type AuthorizationActor = {
  id: string;
  departmentId: string | null;
  roleCode: string;
  roleLevel: number;
  permissions: PermissionSet;
};

export type TaskParticipant = {
  userId: string;
  assignmentRole: "owner" | "assignee" | "watcher";
};

export type TaskAccessSnapshot = {
  id: string;
  departmentId: string | null;
  createdBy: string | null;
  ownerId: string | null;
  assigneeId: string | null;
  reviewerId: string | null;
  departmentManagerId: string | null;
  selfClaimable: boolean;
  taskType: "assigned" | "personal" | null;
  status: string;
  participants: TaskParticipant[];
};

export type TaskAction =
  | "view"
  | "assign"
  | "update"
  | "assigned_cancel"
  | "admin_edit"
  | "claim"
  | "report"
  | "complete_assigned"
  | "review"
  | "comment"
  | "attachment"
  | "personal_edit"
  | "personal_deadline"
  | "personal_cancel"
  | "personal_complete"
  | "evaluate"
  | "leader_evaluate"
  | "legacy_evaluate";

export type EvaluationDecision =
  | {
      action: "step1" | "step2";
      employeeId: string;
      employeeDepartmentId: string | null;
      managerId: string | null;
    }
  | { action: "manage_rubrics" };

const TASK_READ_ONLY_ROLES = new Set(["tbt_read_only"]);
const ORGANIZATION_VIEW_ROLES = new Set([
  "admin",
  "tong_bien_tap",
  "tbt_read_only",
]);

export const hasOrganizationTaskView = (
  actor: AuthorizationActor,
) => ORGANIZATION_VIEW_ROLES.has(actor.roleCode);

const isParticipant = (
  actor: AuthorizationActor,
  task: TaskAccessSnapshot,
  includeWatcher = true,
) => task.participants.some(
  (participant) =>
    participant.userId === actor.id
    && (includeWatcher || participant.assignmentRole !== "watcher"),
);

const isRelated = (
  actor: AuthorizationActor,
  task: TaskAccessSnapshot,
) => [
  task.createdBy,
  task.ownerId,
  task.assigneeId,
  task.reviewerId,
].includes(actor.id) || isParticipant(actor, task);

const sameDepartment = (
  actor: AuthorizationActor,
  task: TaskAccessSnapshot,
) => actor.departmentId !== null
  && task.departmentId !== null
  && actor.departmentId === task.departmentId;

export function canAssignToDepartment(
  actor: AuthorizationActor,
  departmentId: string | null,
): boolean {
  if (TASK_READ_ONLY_ROLES.has(actor.roleCode)) return false;
  if (!actor.permissions.can_assign_task
    && !["tong_bien_tap", "pho_tong_bien_tap"].includes(actor.roleCode)) return false;
  return actor.roleCode === "admin"
    || actor.roleCode === "tong_bien_tap"
    || actor.roleCode === "pho_tong_bien_tap"
    || (
      actor.departmentId !== null
      && departmentId !== null
      && departmentId === actor.departmentId
    );
}

export function canTaskAction(
  actor: AuthorizationActor,
  task: TaskAccessSnapshot,
  action: TaskAction,
): boolean {
  if (action === "view") {
    return hasOrganizationTaskView(actor)
      || isRelated(actor, task)
      || (
        actor.permissions.can_view_department_tasks
        && sameDepartment(actor, task)
      );
  }

  if (actor.roleCode === "tbt_read_only") return false;
  if (actor.roleCode === "tong_bien_tap" && !["assign", "comment", "leader_evaluate", "review"].includes(action)) {
    return false;
  }

  switch (action) {
    case "assign":
      return canAssignToDepartment(actor, task.departmentId);
    case "update":
      return actor.roleCode === "admin"
        || task.createdBy === actor.id
        || (
          (actor.permissions.can_assign_task || isLeadershipAssignmentReviewer(actor.roleCode))
          && sameDepartment(actor, task)
        );
    case "assigned_cancel":
      return actor.roleCode === "admin" || task.createdBy === actor.id;
    case "admin_edit":
      return actor.roleCode === "admin";
    case "claim":
      return task.selfClaimable
        && task.status === "new"
        && task.assigneeId === null;
    case "report":
      return actor.roleCode === "admin"
        || task.ownerId === actor.id
        || task.assigneeId === actor.id
        || isParticipant(actor, task, false);
    case "complete_assigned":
      return task.taskType === "assigned"
        && task.assigneeId === actor.id
        && !["pending_review", "done", "cancelled"].includes(task.status);
    case "review":
      return actor.roleCode === "admin"
        || (
          task.reviewerId === actor.id
          && (
            isLeadershipAssignmentReviewer(actor.roleCode)
            || task.departmentManagerId === actor.id
          )
        );
    case "comment":
      return actor.permissions.can_comment
        && canTaskAction(actor, task, "view");
    case "attachment":
      return actor.roleCode === "admin"
        || task.createdBy === actor.id
        || task.ownerId === actor.id
        || task.assigneeId === actor.id
        || isParticipant(actor, task, false)
        || (actor.permissions.can_assign_task && sameDepartment(actor, task));
    case "personal_edit":
    case "personal_deadline":
    case "personal_cancel":
    case "personal_complete":
      return task.taskType === "personal"
        && (task.ownerId === actor.id || actor.roleCode === "admin")
        && !["done", "cancelled"].includes(task.status);
    case "evaluate":
    case "legacy_evaluate":
      return actor.roleCode === "admin"
        || (
          actor.permissions.can_evaluate_step1
          && (
            task.createdBy === actor.id
            || task.reviewerId === actor.id
          )
        );
    case "leader_evaluate":
      return actor.roleCode === "admin"
        || (actor.roleCode === "tong_bien_tap" && actor.permissions.can_evaluate_step2)
        || (actor.permissions.can_evaluate_step1 && task.departmentManagerId === actor.id);
  }
}

export function canEvaluationAction(
  actor: AuthorizationActor,
  decision: EvaluationDecision,
): boolean {
  if (decision.action === "manage_rubrics") {
    return actor.roleCode === "admin"
      && actor.permissions.can_manage_rubrics;
  }

  if (decision.action === "step2") {
    return actor.roleCode === "tong_bien_tap"
      && actor.permissions.can_evaluate_step2;
  }

  return actor.permissions.can_evaluate_step1
    && actor.id !== decision.employeeId
    && actor.id === decision.managerId
    && actor.departmentId !== null
    && decision.employeeDepartmentId !== null
    && actor.departmentId === decision.employeeDepartmentId;
}
