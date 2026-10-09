import { redirect } from "next/navigation";
import QuickReportWorkspace from "@/components/QuickReportWorkspace";
import { getSessionUser } from "@/lib/serverSession";

export default async function QuickReportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.rbacPermissions.includes("task.quick_report.create")) redirect("/tasks");
  return <QuickReportWorkspace />;
}
