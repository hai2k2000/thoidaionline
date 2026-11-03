import { projectRepository } from "@/lib/projectRepository";
import { isProjectCreator, requireProjectLead } from "@/lib/projectApiGuards";
import { apiError, apiJson, asUuid, requireReadActor, rpcFailure } from "@/lib/serverApi";
export async function GET(request: Request) {
 const guard = await requireReadActor(); if (!guard.ok) return guard.response;
 const id = new URL(request.url).searchParams.get("projectId");
 if (id) { if (!asUuid(id)) return apiError("invalid_request",400); const denied = await requireProjectLead(guard.actor,id); if (denied) return denied; }
 else if (!isProjectCreator(guard.actor)) return apiError("forbidden",403);
 const result = await projectRepository.options();
 return result.ok ? apiJson(result.data) : rpcFailure(result.error);
}
