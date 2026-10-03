import { apiError, requireReadActor } from "@/lib/serverApi";
import {
  createDepartmentPlanExcelTemplate,
  DEPARTMENT_PLAN_EXCEL_TEMPLATE_FILENAME,
} from "@/lib/departmentPlanExcelTemplate.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  try {
    const workbook = await createDepartmentPlanExcelTemplate();
    return new Response(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${DEPARTMENT_PLAN_EXCEL_TEMPLATE_FILENAME}"`,
        "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch {
    return apiError("operation_failed", 500);
  }
}
