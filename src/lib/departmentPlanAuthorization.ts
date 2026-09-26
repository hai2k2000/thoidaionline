import type { AuthorizationActor } from "@/lib/authorization";

const GLOBAL_ROLES = new Set(["admin", "tong_bien_tap", "pho_tong_bien_tap"]);

export type DepartmentPlanScope = {
  departmentId: string;
  kind: "own_department" | "global";
};

export const hasGlobalDepartmentPlanAuthority = (actor: AuthorizationActor) => GLOBAL_ROLES.has(actor.roleCode);

export function resolveDepartmentPlanScope(
  actor: AuthorizationActor,
  requestedDepartmentId?: string | null,
): DepartmentPlanScope | null {
  if (hasGlobalDepartmentPlanAuthority(actor)) {
    const departmentId = requestedDepartmentId ?? actor.departmentId;
    return departmentId ? { departmentId, kind: "global" } : null;
  }
  if (actor.isDepartmentManager && actor.departmentId) {
    if (requestedDepartmentId && requestedDepartmentId !== actor.departmentId) return null;
    return { departmentId: actor.departmentId, kind: "own_department" };
  }
  return null;
}

export function canManageDepartmentPlan(
  actor: AuthorizationActor,
  departmentId: string,
): boolean {
  return resolveDepartmentPlanScope(actor, departmentId)?.departmentId === departmentId;
}
