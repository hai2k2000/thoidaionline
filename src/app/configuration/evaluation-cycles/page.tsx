import { redirect } from "next/navigation";
import EvaluationCycleShell from "@/components/EvaluationCycleShell";
import { evaluationRepository } from "@/lib/evaluationRepository";
import { getSessionUser } from "@/lib/serverSession";
export default async function EvaluationCyclesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role_code !== "admin" || !user.permissions.can_manage_rubrics) redirect("/tasks");
  const data = await evaluationRepository.cycles(user.id);
  return <EvaluationCycleShell userLabel={user.full_name} {...data} />;
}
