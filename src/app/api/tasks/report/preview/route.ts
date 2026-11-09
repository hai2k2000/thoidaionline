import { requireReadActor } from "@/lib/serverApi";
import { apiError } from "@/lib/apiResponse";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { parseReportRequest } from "@/lib/taskListReport.mjs";
import { getTaskListReportData } from "@/lib/taskListReportData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  if (isCollaboratorRole(guard.actor.role_code)) return apiError("forbidden", 403);
  const parsed = parseReportRequest(new URL(request.url).searchParams);
  if (!parsed) return apiError("invalid_request", 400);
  const result = await getTaskListReportData(guard.actor, parsed.query, parsed.from, parsed.to);
  if (!result.ok) return result.response;
  return Response.json(result.model, { headers: { "Cache-Control": "no-store" } });
}
