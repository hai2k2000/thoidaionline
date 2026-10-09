import { loadPersonalQuickReportSummary } from "@/lib/quickReportPersonalSummaryService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await loadPersonalQuickReportSummary(request);
  return result.ok
    ? Response.json(result.data, { headers: { "Cache-Control": "private, no-store" } })
    : result.response;
}
