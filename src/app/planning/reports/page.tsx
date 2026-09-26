import { redirect } from "next/navigation";
import DepartmentPlanReport from "@/components/DepartmentPlanReport";
import type { AuthorizationActor } from "@/lib/authorization";
import { resolveDepartmentPlanScope } from "@/lib/departmentPlanAuthorization";
import { canonicalPeriodFromQuery, departmentPlanReportUrl } from "@/lib/departmentPlanNavigation";
import { departmentPlanReportRepository } from "@/lib/departmentPlanReportRepository";
import { isReportAssignmentState, isReportWorkStatus, type DepartmentPlanReportFilters } from "@/lib/departmentPlanReport";
import { departmentPlanRepository } from "@/lib/departmentPlanRepository";
import { asUuid } from "@/lib/serverApi";
import { getSessionUser } from "@/lib/serverSession";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

const actorFromSession = (user: Awaited<ReturnType<typeof getSessionUser>>): AuthorizationActor => ({
  id: user!.id,
  departmentId: user!.department_id,
  departmentCode: user!.department_code,
  roleCode: user!.role_code,
  roleLevel: user!.role_level,
  isDepartmentManager: user!.is_department_manager,
  permissions: user!.permissions,
});

export default async function DepartmentPlanReportsPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const raw = await searchParams;
  const now = new Date();
  const period = canonicalPeriodFromQuery(first(raw.period), first(raw.start), now);
  const requestedDepartment = first(raw.departmentId);
  const departmentId = requestedDepartment ? asUuid(requestedDepartment) : null;
  if (requestedDepartment && !departmentId) redirect(departmentPlanReportUrl(period.periodType, period.periodStart));

  const scope = resolveDepartmentPlanScope(actorFromSession(user), departmentId);
  if (!scope) redirect("/tasks");
  const canonicalUrl = departmentPlanReportUrl(
    period.periodType,
    period.periodStart,
    requestedDepartment ? departmentId : null,
  );
  if (first(raw.period) !== period.periodType || first(raw.start) !== period.periodStart) redirect(canonicalUrl);

  const employeeValue = first(raw.employeeId);
  const employeeId = employeeValue ? asUuid(employeeValue) : null;
  const statusValue = first(raw.status);
  const assignmentValue = first(raw.assignmentState);
  if (employeeValue && !employeeId) redirect(departmentPlanReportUrl(period.periodType, period.periodStart, scope.departmentId));
  if (statusValue && !isReportWorkStatus(statusValue)) redirect(departmentPlanReportUrl(period.periodType, period.periodStart, scope.departmentId));
  if (assignmentValue && !isReportAssignmentState(assignmentValue)) redirect(departmentPlanReportUrl(period.periodType, period.periodStart, scope.departmentId));

  const filters: DepartmentPlanReportFilters = {
    employeeId,
    workStatus: statusValue ? (statusValue as DepartmentPlanReportFilters["workStatus"]) : null,
    assignmentState: assignmentValue ? (assignmentValue as DepartmentPlanReportFilters["assignmentState"]) : null,
  };
  const [department, report] = await Promise.all([
    departmentPlanRepository.getDepartment(scope.departmentId),
    departmentPlanReportRepository.getReport(scope.departmentId, period, filters),
  ]);
  if (department.error) throw new Error("Không thể tải báo cáo kế hoạch phòng.");
  if (report.error) {
    if (report.error.code === "42501") redirect(departmentPlanReportUrl(period.periodType, period.periodStart, scope.departmentId));
    throw new Error("Không thể tải báo cáo kế hoạch phòng.");
  }

  const currentWeeklyPeriod = canonicalPeriodFromQuery("weekly", null, now);
  const currentMonthlyPeriod = canonicalPeriodFromQuery("monthly", null, now);

  return (
    <DepartmentPlanReport
      userLabel={user.full_name}
      departmentName={department.data?.name ?? "Phòng ban được cấp quyền"}
      departmentId={scope.departmentId}
      period={period}
      currentWeeklyPeriod={currentWeeklyPeriod}
      currentMonthlyPeriod={currentMonthlyPeriod}
      initialReport={{
        period: report.data.period,
        plan: report.data.plan,
        employees: report.data.employees,
        filters,
        metrics: report.data.metrics,
        items: report.data.items,
      }}
    />
  );
}
