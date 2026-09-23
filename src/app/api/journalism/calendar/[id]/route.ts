import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { asIsoDate } from "@/lib/journalismMutationValidation";
import { updatePlannedPublicationDate } from "@/lib/journalismCalendarRepository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const taskId = asUuid((await context.params).id);
  const body = await readJsonObject(request);
  if (!taskId || !body || !Object.hasOwn(body, "plannedPublicationAt") || Object.keys(body).some((key) => key !== "plannedPublicationAt")) {
    return apiError("invalid_request", 400);
  }
  const raw = body.plannedPublicationAt;
  const plannedPublicationAt = raw === null ? null : asIsoDate(raw);
  if (plannedPublicationAt === undefined) return apiError("invalid_request", 400);
  const user = guard.actor;
  const result = await updatePlannedPublicationDate({
    id: user.id,
    departmentId: user.department_id,
    departmentCode: user.department_code,
    roleCode: user.role_code,
    roleLevel: user.role_level,
    permissions: user.permissions,
    rbacPermissions: user.rbacPermissions,
  }, taskId, plannedPublicationAt);
  if (result.ok) return apiJson({ task: result.data });
  if (result.error.code === "forbidden") return apiError("forbidden", 403);
  if (result.error.code === "not_found") return apiError("not_found", 404);
  return apiError("operation_failed", 500);
}
