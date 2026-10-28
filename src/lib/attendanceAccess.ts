import "server-only";

import { loadRbacActor } from "@/lib/rbac/repository";
import { scopesFor } from "@/lib/rbac/authorization";
import type { RbacActor, RbacScope } from "@/lib/rbac/types";
import { resolveAttendanceAccessFromScopes } from "./attendanceAccessCore.mjs";

type AttendanceActor = { id: string; department_id?: string | null; departmentId?: string | null; rbacPermissionScopes?: Record<string, string[]> };

export async function resolveAttendanceAccess(actor: AttendanceActor | RbacActor) {
  const rbac = "grants" in actor
    ? actor
    : actor.rbacPermissionScopes
      ? { id: actor.id, departmentId: actor.department_id ?? actor.departmentId ?? null, grants: Object.entries(actor.rbacPermissionScopes).flatMap(([permissionCode, scopes]) => scopes.map((scope) => ({ permissionCode, scope: scope as RbacScope }))) }
      : await loadRbacActor({ id: actor.id, department_id: actor.department_id ?? actor.departmentId ?? null });
  return resolveAttendanceAccessFromScopes({
    "attendance.view_all": scopesFor(rbac, "attendance.view_all"),
    "attendance.manage": scopesFor(rbac, "attendance.manage"),
  });
}
