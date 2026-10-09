import { apiError } from "@/lib/serverApi";
import { loadPersonalWeeklyReport } from "@/lib/personalWeeklyReportService";
import { exportPersonalWeeklyReportDocx, personalWeeklyReportDocxFilename } from "@/lib/personalWeeklyReportDocx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await loadPersonalWeeklyReport(request);
  if (!result.ok) return result.response;
  if (result.data.report?.status !== "COMPLETED") return apiError("conflict", 409);
  const buffer = await exportPersonalWeeklyReportDocx(result.data);
  const employeeName = typeof result.data.employee?.full_name === "string" ? result.data.employee.full_name : "Nhan vien";
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${personalWeeklyReportDocxFilename(employeeName, result.data.period.current)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
