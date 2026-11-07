import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import { announcementRepository } from "@/lib/announcementRepository";
import { validateAnnouncementInput } from "@/lib/announcementLibrary.mjs";
type Context={params:Promise<{id:string}>};
async function manager(actor:{id:string;department_id:string|null;role_code:string}){return hasPermission(await loadRbacActor(actor),"announcement.manage");}
export async function PATCH(request:Request,{params}:Context){const guard=await requireMutationActor();if(!guard.ok)return guard.response;const id=asUuid((await params).id);if(!id||isCollaboratorRole(guard.actor.role_code)||!(await manager(guard.actor)))return apiError("forbidden",403);const input=validateAnnouncementInput(await readJsonObject(request));if(!input)return apiError("invalid_request",400);const result=await announcementRepository.update(guard.actor.id,id,input);return result.error?apiError("operation_failed",400):apiJson({item:result.data});}
export async function DELETE(_request:Request,{params}:Context){const guard=await requireMutationActor();if(!guard.ok)return guard.response;const id=asUuid((await params).id);if(!id||isCollaboratorRole(guard.actor.role_code)||!(await manager(guard.actor)))return apiError("forbidden",403);const result=await announcementRepository.remove(guard.actor.id,id);return result.error?apiError("operation_failed",400):apiJson({item:result.data});}
