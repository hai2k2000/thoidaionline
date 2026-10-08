import { apiJson } from "@/lib/serverApi";
import { reopenPersonalWeeklyReportRequest } from "@/lib/personalWeeklyReportService";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const result = await reopenPersonalWeeklyReportRequest(request);
  return result.ok ? apiJson({ row: result.data }) : result.response;
}
