import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { loadPersonalWeeklyReport } from "@/lib/personalWeeklyReportService";
import PersonalWeeklyReportPage from "@/components/PersonalWeeklyReportPage";
import WeeklyReportLoadError from "@/components/WeeklyReportLoadError";

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
  const report = typeof params.report === "string" ? params.report : "";
  const query = report ? `?report=${encodeURIComponent(report)}` : periodStart ? `?periodStart=${encodeURIComponent(periodStart)}` : "";
  const result = await loadPersonalWeeklyReport(new Request(`https://internal/reports/weekly${query}`));
  if (!result.ok) return <WeeklyReportLoadError />;
  return <PersonalWeeklyReportPage initial={result.data} />;
}
