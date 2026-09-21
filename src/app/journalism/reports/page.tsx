import { redirect } from "next/navigation";
import JournalismReportingDashboard from "@/components/JournalismReportingDashboard";
import { getSessionUser } from "@/lib/serverSession";
import { loadJournalismReporting } from "@/lib/journalismReportingRepository";
import { parseJournalismReportingSearchParams } from "@/lib/journalismReportingFilters.mjs";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function toSearchParams(input: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) params.set(key, value[0] ?? "");
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}
export default async function JournalismReportsPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const query = parseJournalismReportingSearchParams(toSearchParams(await searchParams));
  const actor = {
    id: user.id,
    departmentId: user.department_id,
    roleCode: user.role_code,
    roleLevel: user.role_level,
    permissions: user.permissions,
  };
  const result = await loadJournalismReporting(actor, query);
  return <JournalismReportingDashboard userLabel={user.full_name} query={query} data={result.ok ? result.data : null} error={!result.ok} />;
}
