import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { loadPersonalWeeklyReport } from "@/lib/personalWeeklyReportService";
import PersonalWeeklyReportPage from "@/components/PersonalWeeklyReportPage";

export const dynamic = "force-dynamic";

export default async function PersonalWeeklyReportRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const periodStart = typeof params.periodStart === "string" ? params.periodStart : "";
  const query = periodStart ? `?periodStart=${encodeURIComponent(periodStart)}` : "";
  const result = await loadPersonalWeeklyReport(new Request(`https://internal/reports/weekly${query}`));
  if (!result.ok) redirect("/tasks");
  return <PersonalWeeklyReportPage initial={result.data} />;
}
