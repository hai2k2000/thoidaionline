import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import { sharedLibraryRepository } from "@/lib/sharedLibraryRepository";
type Context={params:Promise<{itemId:string}>};async function manager(a:{id:string;department_id:string|null;role_code:string}){return hasPermission(await loadRbacActor(a),"library.manage");}
export async function PATCH(request:Request,{params}:Context){const g=await requireMutationActor();if(!g.ok)return g.response;const id=asUuid((await params).itemId);if(!id||isCollaboratorRole(g.actor.role_code)||!(await manager(g.actor)))return apiError("forbidden",403);const b=await readJsonObject(request);const patch={title:typeof b?.title==="string"?b.title:undefined,description:typeof b?.description==="string"?b.description:b?.description===null?null:undefined,folderId:asUuid(b?.folderId)||undefined};const r=await sharedLibraryRepository.updateItem(g.actor.id,id,patch);return r.error?apiError("operation_failed",400):apiJson({item:r.data});}
export async function DELETE(_r:Request,{params}:Context){const g=await requireMutationActor();if(!g.ok)return g.response;const id=asUuid((await params).itemId);if(!id||isCollaboratorRole(g.actor.role_code)||!(await manager(g.actor)))return apiError("forbidden",403);const r=await sharedLibraryRepository.removeItem(g.actor.id,id);return r.error?apiError("operation_failed",400):apiJson({item:r.data});}
