export type AssetVisibilityActor = {
  id: string;
  departmentId: string | null;
  isDepartmentManager: boolean;
  rbacPermissions: readonly string[];
};

export type CurrentAssetAssignment = {
  departmentId: string | null;
  assigneeId: string | null;
};

export function canManageAssets(actor: AssetVisibilityActor): boolean {
  return actor.rbacPermissions.includes("asset.manage");
}

export function canViewAsset(
  actor: AssetVisibilityActor,
  assignment: CurrentAssetAssignment | null,
): boolean {
  if (canManageAssets(actor)) return true;
  if (!actor.rbacPermissions.includes("asset.view") || !assignment) return false;
  if (assignment.assigneeId === actor.id) return true;
  if (!actor.departmentId || assignment.departmentId !== actor.departmentId) return false;
  return actor.isDepartmentManager || assignment.assigneeId === null;
}
