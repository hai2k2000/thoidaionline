import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { resolveDepartmentPlanScope } from "@/lib/departmentPlanAuthorization";
import { departmentPlanRepository } from "@/lib/departmentPlanRepository";

export const dynamic = "force-dynamic";

const repositoryError = (error: { code?: string | null } | null | undefined) => {
  if (error?.code === "23505") return apiError("conflict", 409);
  if (error?.code === "42501") return apiError("forbidden", 403);
  if (error?.code === "P0002") return apiError("not_found", 404);
  if (error?.code === "22023" || error?.code === "22007") return apiError("invalid_request", 400);
  return apiError("operation_failed", 500);
};

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const planId = asUuid(body?.current_plan_id);
  const departmentId = asUuid(body?.department_id);
  if (!planId || !departmentId || !Array.isArray(body?.items)) return apiError("invalid_request", 400);
  const actor = guard.actor;
  const scope = resolveDepartmentPlanScope({ id: actor.id, departmentId: actor.department_id, departmentCode: actor.department_code, roleCode: actor.role_code, roleLevel: actor.role_level, isDepartmentManager: actor.is_department_manager, permissions: actor.permissions }, departmentId);
  if (!scope) return apiError("forbidden", 403);
  const plan = await departmentPlanRepository.getPlan(planId);
  if (plan.error) return repositoryError(plan.error);
  if (!plan.data || plan.data.department_id !== departmentId || plan.data.period_type !== body.periodType || plan.data.period_start !== body.periodStart || plan.data.period_end !== body.periodEnd) return apiError("invalid_request", 400);
  if (plan.data.status === "closed") return apiError("invalid_request", 400);
  const items = body.items as Array<Record<string, unknown>>;
  const employeeIds = await departmentPlanRepository.listActiveEmployees(departmentId);
  if (employeeIds.error) return repositoryError(employeeIds.error);
  const allowedIds = new Set((employeeIds.data ?? []).map((employee) => employee.id));
  for (const item of items) {
    const assigneeIds = Array.isArray(item.assigneeIds) ? item.assigneeIds.filter((value): value is string => typeof value === "string") : [];
    if (assigneeIds.some((id) => !allowedIds.has(id))) return apiError("forbidden", 403);
    if (assigneeIds.length > 0 && (typeof item.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate))) return apiError("invalid_request", 400);
  }
  const result = await departmentPlanRepository.importItemsIntoPlan(actor.id, planId, items);
  if (result.error) return repositoryError(result.error);
  return apiJson({ plan: plan.data, imported: result.data?.imported ?? [], skipped: result.data?.skipped ?? [] });
}
