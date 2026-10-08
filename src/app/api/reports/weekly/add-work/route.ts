import { apiError, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { personalWeeklyPeriod } from "@/lib/personalWeeklyReport";
import { taskHandlers } from "@/lib/taskHandlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (!guard.actor.rbacPermissions.includes("task.quick_report.create")) return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  if (!body || !body.period || typeof body.period !== "object" || Array.isArray(body.period) || !Array.isArray(body.rows)) return apiError("invalid_request", 400);
  const period = body.period as Record<string, unknown>;
  if (typeof period.start !== "string" || typeof period.end !== "string") return apiError("invalid_request", 400);
  const canonical = personalWeeklyPeriod(period.start).current;
  if (canonical.start !== period.start || canonical.end !== period.end) return apiError("invalid_request", 400);
  const inPeriod = body.rows.every((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    const startDate = (row as Record<string, unknown>).startDate;
    return typeof startDate === "string" && startDate >= canonical.start && startDate < canonical.end;
  });
  if (!inPeriod) return apiError("invalid_request", 400);
  return taskHandlers.quickReport(new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: body.requestId, rows: body.rows }),
  }));
}
