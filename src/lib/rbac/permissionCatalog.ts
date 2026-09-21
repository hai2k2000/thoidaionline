export const RBAC_PERMISSION_CODES = [
  "task.view",
  "task.create",
  "task.assign",
  "task.comment",
  "task.edit_all",
  "task.review",
  "task.score",
  "task.evaluate.step1",
  "task.evaluate.step2",
  "staff.view",
  "staff.manage",
  "permission.manage",
  "evaluation.rubric.manage",
  "attendance.view_self",
  "attendance.view_all",
  "leave.view_self",
  "schedule.view_self",
  "journalism.metadata.update",
  "journalism.publication.manage",
  "journalism.publication.verify",
] as const;

export type RbacPermissionCode = (typeof RBAC_PERMISSION_CODES)[number];
