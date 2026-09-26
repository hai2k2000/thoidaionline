import "server-only";

import type { AuthorizationActor } from "@/lib/authorization";
import { resolveDepartmentPlanScope } from "@/lib/departmentPlanAuthorization";
import {
  getDepartmentPlanPeriod,
  isDepartmentPlanPeriodType,
} from "@/lib/departmentPlanPeriod";
import {
  isReportAssignmentState,
  isReportWorkStatus,
  type DepartmentPlanReportFilters,
} from "@/lib/departmentPlanReport";
import { departmentPlanReportRepository } from "@/lib/departmentPlanReportRepository";
import { departmentPlanRepository } from "@/lib/departmentPlanRepository";
import {
  apiError,
  asUuid,
  requireReadActor,
} from "@/lib/serverApi";
import type { ServerAuthUser } from "@/lib/serverSession";

const asActor = (actor: ServerAuthUser): AuthorizationActor => ({
  id: actor.id,
  departmentId: actor.department_id,
  departmentCode: actor.department_code,
  roleCode: actor.role_code,
  roleLevel: actor.role_level,
  isDepartmentManager: actor.is_department_manager,
  permissions: actor.permissions,
});

const parsePeriod = (periodType: unknown, periodStart: unknown) => {
  if (!isDepartmentPlanPeriodType(periodType)) return null;
  try {
    return getDepartmentPlanPeriod(
      periodType,
      typeof periodStart === "string" ? periodStart : null,
    );
  } catch {
    return null;
  }
};

const errorResponse = (error: { code?: string | null } | null | undefined) => {
  if (error?.code === "42501") return apiError("forbidden", 403);
  if (error?.code === "23514" || error?.code === "22023" || error?.code === "22007") {
    return apiError("invalid_request", 400);
  }
  return apiError("operation_failed", 500);
};

export type AuthorizedDepartmentPlanReport = {
  actor: ServerAuthUser;
  departmentId: string;
  departmentName: string;
  filters: DepartmentPlanReportFilters;
  report: NonNullable<Awaited<ReturnType<typeof departmentPlanReportRepository.getReport>>["data"]>;
};

export async function loadAuthorizedDepartmentPlanReport(
  request: Request,
): Promise<
  | { ok: true; data: AuthorizedDepartmentPlanReport }
  | { ok: false; response: Response }
> {
  const guard = await requireReadActor();
  if (!guard.ok) return guard;

  const url = new URL(request.url);
  const requestedDepartment = url.searchParams.get("departmentId");
  const departmentId = requestedDepartment ? asUuid(requestedDepartment) : null;
  if (requestedDepartment && !departmentId) {
    return { ok: false, response: apiError("invalid_request", 400) };
  }

  const scope = resolveDepartmentPlanScope(asActor(guard.actor), departmentId);
  if (!scope) return { ok: false, response: apiError("forbidden", 403) };

  const period = parsePeriod(
    url.searchParams.get("period") ?? url.searchParams.get("periodType") ?? "weekly",
    url.searchParams.get("start") ?? url.searchParams.get("periodStart"),
  );
  if (!period) return { ok: false, response: apiError("invalid_request", 400) };

  const employeeValue = url.searchParams.get("employeeId");
  const employeeId = employeeValue ? asUuid(employeeValue) : null;
  if (employeeValue && !employeeId) {
    return { ok: false, response: apiError("invalid_request", 400) };
  }

  const statusValue = url.searchParams.get("status");
  if (statusValue && !isReportWorkStatus(statusValue)) {
    return { ok: false, response: apiError("invalid_request", 400) };
  }
  const assignmentValue = url.searchParams.get("assignmentState");
  if (assignmentValue && !isReportAssignmentState(assignmentValue)) {
    return { ok: false, response: apiError("invalid_request", 400) };
  }

  const filters: DepartmentPlanReportFilters = {
    employeeId,
    workStatus: statusValue ? statusValue as DepartmentPlanReportFilters["workStatus"] : null,
    assignmentState: assignmentValue ? assignmentValue as DepartmentPlanReportFilters["assignmentState"] : null,
  };
  const [report, department] = await Promise.all([
    departmentPlanReportRepository.getReport(scope.departmentId, period, filters),
    departmentPlanRepository.getDepartment(scope.departmentId),
  ]);
  if (report.error) return { ok: false, response: errorResponse(report.error) };
  if (department.error) return { ok: false, response: errorResponse(department.error) };

  return {
    ok: true,
    data: {
      actor: guard.actor,
      departmentId: scope.departmentId,
      departmentName: department.data?.name ?? "Phòng ban được cấp quyền",
      filters,
      report: report.data,
    },
  };
}
