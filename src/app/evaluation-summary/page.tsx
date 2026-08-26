import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import PublicEvaluationSummary from "@/components/PublicEvaluationSummary";

export default async function Page() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <PublicEvaluationSummary userLabel={user.full_name} />;
}
