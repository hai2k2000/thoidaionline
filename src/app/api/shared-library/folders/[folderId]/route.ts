import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import { sharedLibraryRepository } from "@/lib/sharedLibraryRepository";
type Context={params:Promise<{folderId:string}>};async function manager(a:{id:string;department_id:string|null;role_code:string}){return hasPermission(await loadRbacActor(a),"library.manage");}
export async function PATCH(request:Request,{params}:Context){const g=await requireMutationActor();if(!g.ok)return g.response;const id=asUuid((await params).folderId);if(!id||isCollaboratorRole(g.actor.role_code)||!(await manager(g.actor)))return apiError("forbidden",403);const b=await readJsonObject(request);const r=await sharedLibraryRepository.renameFolder(g.actor.id,id,typeof b?.name==="string"?b.name:"");return r.error?apiError("operation_failed",400):apiJson({folder:r.data});}
export async function DELETE(_r:Request,{params}:Context){const g=await requireMutationActor();if(!g.ok)return g.response;const id=asUuid((await params).folderId);if(!id||isCollaboratorRole(g.actor.role_code)||!(await manager(g.actor)))return apiError("forbidden",403);const r=await sharedLibraryRepository.removeFolder(g.actor.id,id);return r.error?apiError("operation_failed",400):apiJson({folder:r.data});}
