import { redirect } from "next/navigation";
import DepartmentPlanShell from "@/components/DepartmentPlanShell";
import type { AuthorizationActor } from "@/lib/authorization";
import { resolveDepartmentPlanScope } from "@/lib/departmentPlanAuthorization";
import { canonicalPeriodFromQuery, departmentPlanUrl } from "@/lib/departmentPlanNavigation";
import { departmentPlanRepository, type DepartmentPlanRow } from "@/lib/departmentPlanRepository";
import { asUuid } from "@/lib/serverApi";
import { taskAssignmentRepository } from "@/lib/taskAssignmentRepository";
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
  const requestedDepartment = first(raw.departmentId);
  const requestedDepartmentId = requestedDepartment ? asUuid(requestedDepartment) : null;
  const planIdValue = first(raw.plan_id);
  const planId = planIdValue ? asUuid(planIdValue) : null;
  if ((requestedDepartment && !requestedDepartmentId) || (planIdValue && !planId)) redirect("/tasks");
  const historicalPlanResult = planId ? await departmentPlanRepository.getPlan(planId) : null;
  if (historicalPlanResult?.error) throw new Error("Không thể tải kế hoạch phòng.");
  const historicalPlan = historicalPlanResult?.data ?? null;
  if (planId && !historicalPlan) redirect("/tasks");
  if (historicalPlan && requestedDepartmentId && historicalPlan.department_id !== requestedDepartmentId) redirect("/tasks");
  const period = historicalPlan
    ? { periodType: historicalPlan.period_type, periodStart: historicalPlan.period_start, periodEnd: historicalPlan.period_end }
    : canonicalPeriodFromQuery(first(raw.period), first(raw.start), now);
  const scope = resolveDepartmentPlanScope(actorFromSession(user), historicalPlan?.department_id ?? requestedDepartmentId);
  if (!scope) redirect("/tasks");

  const canonicalUrl = departmentPlanUrl(period.periodType, period.periodStart, requestedDepartmentId ?? scope.departmentId);
  const currentWeeklyPeriod = canonicalPeriodFromQuery("weekly", null, now);
  const currentMonthlyPeriod = canonicalPeriodFromQuery("monthly", null, now);
  const queryPeriod = first(raw.period);
  const queryStart = first(raw.start);
  if (!historicalPlan && (queryPeriod !== period.periodType || queryStart !== period.periodStart)) redirect(canonicalUrl);

  const assignmentActor = actorFromSession(user);
  const planResult = historicalPlan
    ? { data: historicalPlan as DepartmentPlanRow, error: null }
    : departmentPlanRepository.getPeriod(scope.departmentId, period.periodType, period.periodStart);
  const [department, employees, plan, assignmentOptions] = await Promise.all([
    departmentPlanRepository.getDepartment(scope.departmentId),
    departmentPlanRepository.listActiveEmployees(scope.departmentId),
    planResult,
    taskAssignmentRepository.options(assignmentActor),
  ]);
  if (department.error || employees.error || plan.error || !assignmentOptions.ok) throw new Error("Không thể tải kế hoạch phòng.");
  const items = plan.data ? await departmentPlanRepository.listPlanItems(plan.data.id) : { data: [], error: null };
  if (items.error) throw new Error("Không thể tải mục kế hoạch phòng.");

  return <DepartmentPlanShell
    userLabel={user.full_name}
    departmentName={department.data?.name ?? "Phòng ban được cấp quyền"}
    departmentCode={department.data?.code ?? null}
    departmentManagerId={department.data?.manager_id ?? null}
    scopeKind={scope.kind}
    assignmentDepartments={assignmentOptions.departments}
    assignmentPeople={assignmentOptions.people}
    assignmentScope={assignmentOptions.scope}
    departmentId={scope.departmentId}
    period={period}
    currentWeeklyPeriod={currentWeeklyPeriod}
    currentMonthlyPeriod={currentMonthlyPeriod}
    employees={employees.data ?? []}
    initialPlan={plan.data}
    initialItems={items.data ?? []}
    historicalPlanId={planId}
  />;
}
