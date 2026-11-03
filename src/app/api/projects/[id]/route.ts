import { parseProject } from "@/lib/projectValidation";
import { projectRepository } from "@/lib/projectRepository";
import { projectReader, requireProjectLead } from "@/lib/projectApiGuards";
import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const guard = await requireReadActor(); if (!guard.ok) return guard.response; const { id } = await params; if (!asUuid(id)) return apiError("invalid_request", 400);
  const [project, members, tasks] = await Promise.all([
    projectRepository.get(projectReader(guard.actor), id),
    projectRepository.listMembers(projectReader(guard.actor), id),
    projectRepository.listTasks(projectReader(guard.actor), id),
  ]);
  if (!project.ok) return rpcFailure(project.error); if (!project.data) return apiError("not_found", 404);
  if (!members.ok) return rpcFailure(members.error); if (!tasks.ok) return rpcFailure(tasks.error);
  return apiJson({ project: project.data, members: members.data, tasks: tasks.data });
}
export async function PATCH(request: Request, { params }: Context) {
  const guard = await requireMutationActor(); if (!guard.ok) return guard.response; const { id } = await params; if (!asUuid(id)) return apiError("invalid_request", 400); const denied = await requireProjectLead(guard.actor, id); if (denied) return denied; const body = await readJsonObject(request);
  const action = body?.action;
  if (action === "close") { const result = await projectRepository.close(guard.actor.id, id); return result.ok ? apiJson({ project: result.data }) : rpcFailure(result.error); }
  const input = parseProject(body); if (!input) return apiError("invalid_request", 400);
  const result = await projectRepository.update(guard.actor.id, id, input);
  return result.ok ? apiJson({ project: result.data }) : rpcFailure(result.error);
}
