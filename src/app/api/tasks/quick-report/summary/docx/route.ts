import { loadPersonalQuickReportSummary } from "@/lib/quickReportPersonalSummaryService";
import { MAX_PERSONAL_QUICK_REPORT_ROWS } from "@/lib/quickReportPersonalSummary";
import { exportPersonalQuickReportDocx, personalQuickReportDocxFilename } from "@/lib/quickReportPersonalSummaryDocx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  url.searchParams.set("page", "1");
  url.searchParams.set("pageSize", String(MAX_PERSONAL_QUICK_REPORT_ROWS));
  const result = await loadPersonalQuickReportSummary(new Request(url), { pageSizeLimit: MAX_PERSONAL_QUICK_REPORT_ROWS });
  if (!result.ok) return result.response;
  const buffer = await exportPersonalQuickReportDocx(result.data.report.rows, result.data.actor.full_name, { from: result.data.from, to: result.data.to });
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${personalQuickReportDocxFilename(result.data.actor.full_name, { from: result.data.from, to: result.data.to })}"`,
      "Cache-Control": "no-store",
    },
  });
}