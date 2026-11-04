import { parseProjectAssignment } from "@/lib/projectValidation";
import { projectRepository } from "@/lib/projectRepository";
import { projectReader, requireProjectLeadOrDeputy } from "@/lib/projectApiGuards";
import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
const privateAttachments = () => serverSupabase.storage.from("task-private");
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const guard = await requireReadActor(); if (!guard.ok) return guard.response; const { id } = await params; if (!asUuid(id)) return apiError("invalid_request", 400); const url = new URL(request.url);
  const result = await projectRepository.listTasks(projectReader(guard.actor), id, { status: url.searchParams.get("status") ?? undefined, assigneeId: url.searchParams.get("assigneeId") ?? undefined });
  return result.ok ? apiJson({ tasks: result.data }) : rpcFailure(result.error);
}
export async function POST(request: Request, { params }: Context) {
  const guard = await requireMutationActor(); if (!guard.ok) return guard.response; const { id } = await params; if (!asUuid(id)) return apiError("invalid_request", 400); const denied = await requireProjectLeadOrDeputy(guard.actor, id); if (denied) return denied; const body = await readJsonObject(request);
  const input = parseProjectAssignment(body); if (!input) return apiError("invalid_request", 400);
  const result = await projectRepository.assignTask(guard.actor.id, id, input);
  return result.ok ? apiJson({ task: result.data }, 201) : rpcFailure(result.error);
}
export async function DELETE(request: Request, { params }: Context) {
  const guard = await requireMutationActor(); if (!guard.ok) return guard.response;
  const { id } = await params; if (!asUuid(id)) return apiError("invalid_request", 400);
  const body = await readJsonObject(request); const raw = body?.taskIds;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 100 || raw.some(item => !asUuid(item))) return apiError("invalid_request", 400);
  const result = await projectRepository.deleteCancelledTasks(guard.actor.id, id, raw as string[]);
  // rpcFailure maps 42501 -> 403, 22023 -> 400 and 55000 -> 409.
  if (!result.ok) return rpcFailure(result.error);
  let storageWarnings = 0;
  if (result.data.storage_paths?.length) {
    try {
      const removed = await privateAttachments().remove(result.data.storage_paths);
      if (removed.error) throw new Error("storage cleanup failed");
    } catch {
      storageWarnings = result.data.storage_paths.length;
      console.warn("[project-task-delete] storage cleanup failed", { storageWarnings });
    }
  }
  return apiJson({ deleted: result.data.deleted, storageWarnings });
}
