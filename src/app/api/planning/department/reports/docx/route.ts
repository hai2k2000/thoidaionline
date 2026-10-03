import { loadAuthorizedDepartmentPlanReport } from "@/lib/departmentPlanReportService";
import { exportDepartmentPlanDocx } from "@/lib/departmentPlanDocxExport";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const loaded = await loadAuthorizedDepartmentPlanReport(request);
  if (!loaded.ok) return loaded.response;
  const buffer = await exportDepartmentPlanDocx(loaded.data.report, loaded.data.departmentName);
  const filename = `ke-hoach-${loaded.data.report.period.periodType}-${loaded.data.report.period.periodStart}.docx`;
  return new Response(new Uint8Array(buffer), { status: 200, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
}
