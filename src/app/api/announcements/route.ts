import { apiError, apiJson, readJsonObject, requireMutationActor, requireReadActor } from "@/lib/serverApi";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import { announcementRepository } from "@/lib/announcementRepository";
import { validateAnnouncementInput } from "@/lib/announcementLibrary.mjs";
export const dynamic = "force-dynamic";
async function canManage(actor: { id: string; department_id: string | null; role_code: string }) { return hasPermission(await loadRbacActor(actor), "announcement.manage"); }
export async function GET(request: Request) { const guard=await requireReadActor(); if(!guard.ok)return guard.response; if(isCollaboratorRole(guard.actor.role_code))return apiError("forbidden",403); const raw=Number(new URL(request.url).searchParams.get("limit")||20); const limit=Number.isFinite(raw)?Math.min(50,Math.max(1,Math.floor(raw))):20; const result=await announcementRepository.listActive(limit); if(result.error)return apiError("service_unavailable",503); return apiJson({items:result.data??[],canManage:await canManage(guard.actor)}); }
export async function POST(request: Request) { const guard=await requireMutationActor(); if(!guard.ok)return guard.response; if(isCollaboratorRole(guard.actor.role_code)||!(await canManage(guard.actor)))return apiError("forbidden",403); const input=validateAnnouncementInput(await readJsonObject(request)); if(!input)return apiError("invalid_request",400); const result=await announcementRepository.create(guard.actor.id,input); if(result.error)return apiError("operation_failed",400); return apiJson({item:result.data,notified:result.notified},201); }
