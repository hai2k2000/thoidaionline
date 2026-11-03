import { projectRepository } from "@/lib/projectRepository";
import { isProjectCreator, projectReader } from "@/lib/projectApiGuards";
import { parseProject, projectIds } from "@/lib/projectValidation";
import { apiError, apiJson, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";
export async function GET() {
  const guard = await requireReadActor(); if (!guard.ok) return guard.response;
  const result = await projectRepository.list(projectReader(guard.actor));
  return result.ok ? apiJson({ projects: result.data }) : rpcFailure(result.error);
}
export async function POST(request: Request) {
  const guard = await requireMutationActor(); if (!guard.ok) return guard.response;
  if (!isProjectCreator(guard.actor)) return apiError("forbidden",403);
  const body = await readJsonObject(request); const input = parseProject(body);
  const requestedLeads = projectIds(body?.leadIds ?? []); const memberIds = projectIds(body?.memberIds ?? []); const deputyIds = projectIds(body?.deputyIds ?? []);
  if (!input || !requestedLeads || !memberIds || !deputyIds) return apiError("invalid_request",400);
  const leadIds = [...new Set([guard.actor.id, ...requestedLeads])];
  const options = await projectRepository.options(); if (!options.ok) return rpcFailure(options.error);
  const active = new Set(options.data.people.map((person) => person.id));
  if ([...leadIds,...memberIds,...deputyIds].some((id) => !active.has(id))) return apiError("invalid_request",400);
  if([...leadIds,...deputyIds].some(id=>options.data.people.find(person=>person.id===id)?.roles?.code==='cong_tac_vien')) return apiError("invalid_request",400);
  const result = await projectRepository.create(guard.actor.id, {...input,leadIds});
  if (!result.ok) return rpcFailure(result.error);
  const failedMemberIds: string[] = [];
  for (const memberId of memberIds.filter((id) => !leadIds.includes(id))) {
    const added = await projectRepository.setMember(guard.actor.id,result.data.id,memberId,"member");
    if (!added.ok) failedMemberIds.push(memberId);
  }
  for (const deputyId of deputyIds.filter(id=>!leadIds.includes(id))) {
    const added=await projectRepository.setMember(guard.actor.id,result.data.id,deputyId,"deputy");
    if(!added.ok) failedMemberIds.push(deputyId);
  }
  // Return the created identity even on partial membership failure; never invite duplicate creation.
  return apiJson({project:result.data,failedMemberIds},201);
}
