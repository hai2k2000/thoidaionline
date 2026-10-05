import "server-only";
import { apiError, asUuid, requireReadActor } from "@/lib/serverApi";
import { canViewWorkReport, periodBounds, resolveWorkReportDepartment, type WorkReportPeriod, type WorkReportSource } from "@/lib/workReport";
import { getWorkReport } from "@/lib/workReportRepository";

export async function loadWorkReport(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard;
  const actor = guard.actor;
  const url = new URL(request.url);
  const requested = url.searchParams.get("departmentId");
  const departmentId = requested ? asUuid(requested) : null;
  if (requested && !departmentId) return { ok: false as const, response: apiError("invalid_request", 400) };
  const scope = resolveWorkReportDepartment({ roleCode: actor.role_code, departmentId: actor.department_id, isDepartmentManager: actor.is_department_manager }, departmentId);
  if (!scope || !canViewWorkReport({ roleCode: actor.role_code, departmentId: actor.department_id, isDepartmentManager: actor.is_department_manager }, scope)) return { ok: false as const, response: apiError("forbidden", 403) };
  const period = (["week", "month", "range"].includes(url.searchParams.get("period") ?? "") ? url.searchParams.get("period") : "week") as WorkReportPeriod;
  const bounds = periodBounds(period, url.searchParams.get("from"), url.searchParams.get("to"));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(20, Number(url.searchParams.get("pageSize") ?? 20) || 20));
  const employeeId = url.searchParams.get("employeeId");
  if (employeeId && !asUuid(employeeId)) return { ok: false as const, response: apiError("invalid_request", 400) };
  const source = url.searchParams.get("source") as WorkReportSource | null;
  const status = url.searchParams.get("status");
  const excludeEmployeeId = actor.role_code === "truong_phong" && actor.is_department_manager === true && actor.department_id === scope
    ? actor.id
    : null;
  const report = await getWorkReport({ departmentId: scope, employeeId, excludeEmployeeId, ...bounds, source, status, page, pageSize });
  if (report.error) return { ok: false as const, response: apiError(report.error.code === "42501" ? "forbidden" : "operation_failed", report.error.code === "42501" ? 403 : 500) };
  return { ok: true as const, data: { actor, departmentId: scope, employeeId, source, status, period, ...bounds, report: report.data } };
}
