import { redirect } from "next/navigation";
import DepartmentPlanShell from "@/components/DepartmentPlanShell";
import type { AuthorizationActor } from "@/lib/authorization";
import { resolveDepartmentPlanScope } from "@/lib/departmentPlanAuthorization";
import { canonicalPeriodFromQuery, departmentPlanUrl } from "@/lib/departmentPlanNavigation";
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

export default async function DepartmentPlanPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const raw = await searchParams;
  const now = new Date();
  const period = canonicalPeriodFromQuery(first(raw.period), first(raw.start), now);
  const requestedDepartment = first(raw.departmentId);
  const departmentId = requestedDepartment ? asUuid(requestedDepartment) : null;
  if (requestedDepartment && !departmentId) redirect(departmentPlanUrl(period.periodType, period.periodStart));
  const scope = resolveDepartmentPlanScope(actorFromSession(user), departmentId);
  if (!scope) redirect("/tasks");

  const canonicalUrl = departmentPlanUrl(period.periodType, period.periodStart, requestedDepartment ? departmentId : null);
  const currentWeeklyPeriod = canonicalPeriodFromQuery("weekly", null, now);
  const currentMonthlyPeriod = canonicalPeriodFromQuery("monthly", null, now);
  const queryPeriod = first(raw.period);
  const queryStart = first(raw.start);
  if (queryPeriod !== period.periodType || queryStart !== period.periodStart) redirect(canonicalUrl);

  const [department, employees, plan] = await Promise.all([
    departmentPlanRepository.getDepartment(scope.departmentId),
    departmentPlanRepository.listActiveEmployees(scope.departmentId),
    departmentPlanRepository.getPeriod(scope.departmentId, period.periodType, period.periodStart),
  ]);
  if (department.error || employees.error || plan.error) throw new Error("Không thể tải kế hoạch phòng.");
  const items = plan.data ? await departmentPlanRepository.listPlanItems(plan.data.id) : { data: [], error: null };
  if (items.error) throw new Error("Không thể tải mục kế hoạch phòng.");

  return <DepartmentPlanShell
    userLabel={user.full_name}
    departmentName={department.data?.name ?? "Phòng ban được cấp quyền"}
    departmentId={scope.departmentId}
    period={period}
    currentWeeklyPeriod={currentWeeklyPeriod}
    currentMonthlyPeriod={currentMonthlyPeriod}
    employees={employees.data ?? []}
    initialPlan={plan.data}
    initialItems={items.data ?? []}
  />;
}
