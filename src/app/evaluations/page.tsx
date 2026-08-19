import { redirect } from "next/navigation";
import PersonnelEvaluationShell from "@/components/PersonnelEvaluationShell";
import { evaluationRepository } from "@/lib/evaluationRepository";
import { parsePersonnelEvaluationFilters } from "@/lib/personnelEvaluationFilters.mjs";
import { getSessionUser } from "@/lib/serverSession";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const todayInVietnam = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

export default async function PersonnelEvaluationsPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const leader = user.role_code === "tong_bien_tap"
    && user.permissions.can_evaluate_step2;
  const manager = user.is_department_manager
    && user.permissions.can_evaluate_step1;
  if (!leader && !manager) redirect("/tasks");

  const filters = parsePersonnelEvaluationFilters(
    await searchParams,
    todayInVietnam(),
  );
  if (filters.ok && filters.employeeId) {
    redirect(`/evaluations/${filters.employeeId}?from=${filters.from}&to=${filters.to}`);
  }
  const actor = {
    id: user.id,
    departmentId: user.department_id,
    roleCode: user.role_code,
    roleLevel: user.role_level,
    permissions: user.permissions,
  };
  const result = filters.ok
    ? await evaluationRepository.personnelList(actor, filters)
    : { ok: true as const, data: {
        subjects: [], detail: null, from: filters.from, to: filters.to,
        selectedEmployeeId: null,
      } };
  if (!result.ok && result.errorCode === "42501") redirect("/tasks");

  return (
    <PersonnelEvaluationShell
      data={result.ok ? result.data : {
        subjects: [], detail: null, from: filters.from, to: filters.to,
        selectedEmployeeId: null,
      }}
      invalidFilters={!filters.ok}
      loadFailed={!result.ok}
      userLabel={user.full_name}
      isLeader={leader}
    />
  );
}
