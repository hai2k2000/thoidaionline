import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { loadWorkReport } from "@/lib/workReportService";
import WorkReportPage from "@/components/WorkReportPage";

export default async function WorkReportRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") query.set(key, value);
  const result = await loadWorkReport(new Request(`https://internal/reports/work?${query}`));
  if (!result.ok) redirect("/tasks");
  const rawReturnTo = params.returnTo;
  const returnTo = typeof rawReturnTo === "string" && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : null;
  return <WorkReportPage initial={{ ...result.data, returnTo }} />;
}
