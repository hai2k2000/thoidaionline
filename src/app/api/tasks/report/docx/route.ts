import { contentDisposition } from "@/lib/contentDisposition.mjs";
import { requireReadActor } from "@/lib/serverApi";
import { apiError } from "@/lib/apiResponse";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { exportTaskListReportDocx, taskListReportDocxFilename } from "@/lib/taskListReportDocx";
import { parseReportRequest, parseReportIds, taskListReportHref, selectTaskListReportModel } from "@/lib/taskListReport.mjs";
import { getTaskListReportData } from "@/lib/taskListReportData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return exportReport(request, false);
}

export async function POST(request: Request) {
  return exportReport(request, true);
}

async function exportReport(request: Request, post: boolean) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  if (isCollaboratorRole(guard.actor.role_code)) return apiError("forbidden", 403);
  let params = new URL(request.url).searchParams;
  let ids: string[] | undefined;
  if (post) {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)
      || !body.filters || typeof body.filters !== "object" || Array.isArray(body.filters)
      || Object.values(body.filters).some(value => value !== null && typeof value !== "string" && typeof value !== "number")
      || typeof body.from !== "string" || typeof body.to !== "string") return apiError("invalid_request", 400);
    // Serialize and parse again so POST filters use exactly the list's validation.
    params = new URL(taskListReportHref(body.filters, { from: body.from, to: body.to }), "http://local").searchParams;
    if (Object.hasOwn(body, "ids")) {
      const parsedIds = Array.isArray(body.ids) ? parseReportIds(body.ids) : null;
      if (!parsedIds) return apiError("invalid_request", 400);
      ids = parsedIds;
    }
  } else if (params.has("ids")) {
    const parsedIds = parseReportIds(params.get("ids"));
    if (!parsedIds) return apiError("invalid_request", 400);
    ids = parsedIds;
  }
  const parsed = parseReportRequest(params);
  if (!parsed) return apiError("invalid_request", 400);
  const { from, to, query } = parsed;
  const result = await getTaskListReportData(guard.actor, query, from, to);
  if (!result.ok) return result.response;
  // Selection is intersected after the actor-scoped read; client IDs grant no access.
  const model = ids === undefined ? result.model : selectTaskListReportModel(result.model, ids);
  const buffer = await exportTaskListReportDocx(model);
  return new Response(new Uint8Array(buffer), { status: 200, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": contentDisposition(taskListReportDocxFilename(from, to)), "Cache-Control": "no-store" } });
}
