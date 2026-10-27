export const RBAC_PERMISSION_CODES = [
  "task.view",
  "task.create",
  "task.quick_report.create",
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
  "leave.approve",
  "schedule.view_self",
  "schedule.business.approve",
  "schedule.event.approve",
  "asset.view",
  "asset.manage",
  "journalism.metadata.update",
  "journalism.publication.manage",
  "journalism.publication.verify",
  "record.discover",
  "record.metadata.view",
  "record.preview",
  "record.download",
  "record.create",
  "record.edit",
  "record.approve",
  "record.self_approve",
  "record.delete",
  "record.restore",
  "record.export",
  "record.acl.manage",
] as const;

export type RbacPermissionCode = (typeof RBAC_PERMISSION_CODES)[number];

export function isCatalogPermission(code: string): code is RbacPermissionCode {
  return (RBAC_PERMISSION_CODES as readonly string[]).includes(code);
}
export { supportedScopesForPermission } from "./permissionScopes.mjs";
