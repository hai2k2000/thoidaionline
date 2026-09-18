import "server-only";

import { loadRbacActor } from "@/lib/rbac/repository";
import type { RbacActor } from "@/lib/rbac/types";

export type JournalismStructure = { departmentId: string | null };

export function canManageJournalismStructure(
  actor: RbacActor,
  structure: JournalismStructure,
): boolean {
  return actor.grants.some((grant) => grant.permissionCode === "journalism.structure.manage"
    && (grant.scope === "all"
      || (grant.scope === "department"
        && structure.departmentId !== null
        && structure.departmentId === actor.departmentId)));
}

export function canCreateJournalismStructure(
  actor: RbacActor,
  departmentId: string | null,
): boolean {
  return canManageJournalismStructure(actor, { departmentId });
}

export async function loadJournalismStructureActor(actor: {
  id: string;
  department_id: string | null;
}) {
  return loadRbacActor(actor);
}
