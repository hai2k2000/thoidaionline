import { parseProjectAssignment } from "@/lib/projectValidation";
import { projectRepository } from "@/lib/projectRepository";
import { projectReader, requireProjectLeadOrDeputy } from "@/lib/projectApiGuards";
import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";
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
