import { redirect } from "next/navigation";
import EvaluationRubricShell from "@/components/EvaluationRubricShell";
import { evaluationRepository } from "@/lib/evaluationRepository";
import { getSessionUser } from "@/lib/serverSession";

export default async function EvaluationRubricsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role_code !== "admin" || !user.permissions.can_manage_rubrics) redirect("/tasks");
  const data = await evaluationRepository.rubrics();
  return <EvaluationRubricShell userLabel={user.full_name} {...data} />;
}
