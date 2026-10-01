import { redirect } from "next/navigation";
import QuickReportForm from "@/components/QuickReportForm";
import { getSessionUser } from "@/lib/serverSession";

export default async function QuickReportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.rbacPermissions.includes("task.quick_report.create")) redirect("/tasks");
  return <QuickReportForm />;
}
