import { apiJson } from "@/lib/serverApi";
import { reopenPersonalWeeklyReportRequest } from "@/lib/personalWeeklyReportService";
import { WORK_REPORTS_PAUSED, workReportsPausedResponse } from "@/lib/workReportsPause";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (WORK_REPORTS_PAUSED) return workReportsPausedResponse();
  const result = await reopenPersonalWeeklyReportRequest(request);
  return result.ok ? apiJson({ row: result.data }) : result.response;
}
