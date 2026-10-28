import { loadWorkReport } from "@/lib/workReportService";
import { WORK_REPORTS_PAUSED, workReportsPausedResponse } from "@/lib/workReportsPause";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (WORK_REPORTS_PAUSED) return workReportsPausedResponse();
  const result = await loadWorkReport(request);
  return result.ok
    ? Response.json(result.data, { headers: { "Cache-Control": "private, no-store" } })
    : result.response;
}
