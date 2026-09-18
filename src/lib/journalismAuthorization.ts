import "server-only";

import type { ServerAuthUser } from "./serverSession";
import type { TaskAccessSnapshot } from "./authorization";
import { canTaskAction } from "./authorization";
import { can } from "./rbac/authorization";
import { loadRbacActor } from "./rbac/repository";

export async function authorizeJournalismPermission(
  user: ServerAuthUser,
  task: TaskAccessSnapshot,
  permission: "journalism.metadata.update" | "journalism.publication.manage",
) {
  if (!canTaskAction({
    id: user.id,
    departmentId: user.department_id,
    roleCode: user.role_code,
    roleLevel: user.role_level,
    permissions: user.permissions,
  }, task, "view")) return false;
  const actor = await loadRbacActor(user);
  return can(actor, permission, {
    kind: "task",
    id: task.id,
    departmentId: task.departmentId,
    createdBy: task.createdBy,
    ownerId: task.ownerId,
    assigneeId: task.assigneeId,
    reviewerId: task.reviewerId,
    participantIds: task.participants.map((item) => item.userId),
  });
}
