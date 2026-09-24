import type { AuthorizationActor, TaskAccessSnapshot } from "./authorization";
import type { TaskDetailDto } from "./taskContracts";

type RepositoryResult<T> = { ok: true; data: T } | { ok: false; error?: { code?: string | null } };

export async function loadPrintableTask({
  actor,
  taskId,
  loadAccess,
  loadDetail,
  canView,
}: {
  actor: AuthorizationActor;
  taskId: string;
  loadAccess: (taskId: string) => Promise<RepositoryResult<TaskAccessSnapshot | null>>;
  loadDetail: (taskId: string, actor: AuthorizationActor) => Promise<RepositoryResult<TaskDetailDto | null>>;
  canView: (actor: AuthorizationActor, access: TaskAccessSnapshot) => boolean;
}) {
  const access = await loadAccess(taskId);
  if (!access.ok || !access.data || !canView(actor, access.data)) {
    return { ok: false as const, reason: "forbidden" as const };
  }
  const detail = await loadDetail(taskId, actor);
  if (!detail.ok || !detail.data) return { ok: false as const, reason: "not_found" as const };
  if (actor.canAccessJournalism === false && detail.data.journalism) {
    return { ok: false as const, reason: "forbidden" as const };
  }
  return { ok: true as const, task: detail.data };
}
