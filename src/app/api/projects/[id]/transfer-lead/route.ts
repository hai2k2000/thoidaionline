import { requireProjectLead } from "@/lib/projectApiGuards";
import { projectRepository } from "@/lib/projectRepository";
import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor, rpcFailure } from "@/lib/serverApi";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  const guard = await requireMutationActor(); if (!guard.ok) return guard.response;
  const { id } = await params; if (!asUuid(id)) return apiError("invalid_request", 400);
  const denied = await requireProjectLead(guard.actor, id); if (denied) return denied;
  const body = await readJsonObject(request);
  if (!asUuid(body?.userId) || !["lead", "deputy", "member"].includes(String(body?.ownRole))) return apiError("invalid_request", 400);
  const result = await projectRepository.transferLead(guard.actor.id, id, body!.userId as string, body!.ownRole as "lead" | "deputy" | "member");
  return result.ok ? apiJson({ result: result.data }) : rpcFailure(result.error);
}
