import "server-only";

import { renderDepartmentPlanPdf, buildDepartmentPlanPdfModel } from "@/lib/departmentPlanPdf";
import { loadAuthorizedDepartmentPlanReport } from "@/lib/departmentPlanReportService";
import { formatDepartmentPlanPeriod } from "@/lib/departmentPlanNavigation";

export async function departmentPlanPdfHandler(request: Request): Promise<Response> {
  const loaded = await loadAuthorizedDepartmentPlanReport(request);
  if (!loaded.ok) return loaded.response;
  try {
    const model = buildDepartmentPlanPdfModel({
      departmentName: loaded.data.departmentName,
      periodLabel: formatDepartmentPlanPeriod(
        loaded.data.report.period.periodType,
        loaded.data.report.period.periodStart,
        loaded.data.report.period.periodEnd,
      ),
      report: loaded.data.report,
      filters: loaded.data.filters,
    });
    const pdf = await renderDepartmentPlanPdf(model);
    return new Response(pdf.bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.filename}"`,
        "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
        "Content-Length": String(pdf.bytes.byteLength),
      },
    });
  } catch {
    return Response.json({ error: { code: "operation_failed" } }, {
      status: 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
