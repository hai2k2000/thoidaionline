import { notFound, redirect } from "next/navigation";
import EvaluationCycleDetailShell from "@/components/EvaluationCycleDetailShell";
import { evaluationRepository } from "@/lib/evaluationRepository";
import { getSessionUser } from "@/lib/serverSession";
import { UUID_PATTERN } from "@/lib/serverApi";
export default async function EvaluationCycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) redirect("/login");
  if (user.role_code !== "admin" || !user.permissions.can_manage_rubrics) redirect("/tasks");
  const { id } = await params; if (!UUID_PATTERN.test(id)) notFound();
  const result = await evaluationRepository.cycleDetail(id); if (!result.ok) notFound();
  return <EvaluationCycleDetailShell userLabel={user.full_name} cycle={result.data} />;
}
