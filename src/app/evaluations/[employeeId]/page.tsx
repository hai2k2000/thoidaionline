import { notFound, redirect } from "next/navigation";
import PersonnelEvaluationDetailShell from "@/components/PersonnelEvaluationDetailShell";
import { evaluationRepository } from "@/lib/evaluationRepository";
import { parsePersonnelEvaluationFilters } from "@/lib/personnelEvaluationFilters.mjs";
import { asUuid } from "@/lib/serverApi";
import { getSessionUser } from "@/lib/serverSession";

type Props = {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const todayInVietnam = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export default async function PersonnelEvaluationDetailPage({ params, searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const leader = user.role_code === "tong_bien_tap" && user.permissions.can_evaluate_step2;
  const manager = user.is_department_manager && user.permissions.can_evaluate_step1;
  if (!leader && !manager) redirect("/tasks");

  const employeeId = asUuid((await params).employeeId);
  if (!employeeId) notFound();
  const filters = parsePersonnelEvaluationFilters(await searchParams, todayInVietnam());
  if (!filters.ok) notFound();
  const actor = {
    id: user.id, departmentId: user.department_id, roleCode: user.role_code,
    roleLevel: user.role_level, permissions: user.permissions,
  };
  const result = await evaluationRepository.personnelDetail(actor, {
    from: filters.from, to: filters.to, employeeId,
  });
  if (!result.ok && result.errorCode === "42501") notFound();
  if (!result.ok) throw new Error("Không thể tải chi tiết đánh giá nhân sự.");
  return <PersonnelEvaluationDetailShell
    detail={result.data} userLabel={user.full_name}
    from={filters.from} to={filters.to}
  />;
}
