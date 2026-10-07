import { apiError, apiJson, readJsonObject, requireMutationActor, rpcFailure } from "@/lib/serverApi";
import { completePersonalWeeklyReport } from "@/lib/personalWeeklyReportService";
import { validatePersonalWeeklyDraft } from "@/lib/personalWeeklyReport";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  if (!body) return apiError("invalid_request", 400);
  const draftPayload = body.draftPayload && typeof body.draftPayload === "object" && !Array.isArray(body.draftPayload)
    ? body.draftPayload as Record<string, unknown>
    : {};
  const safe = {
    period: body.period,
    periodStart: body.periodStart,
    currentRows: Array.isArray(body.currentRows) ? body.currentRows : draftPayload.currentRows,
    nextRows: Array.isArray(body.nextRows) ? body.nextRows : draftPayload.nextRows,
    difficulties: typeof body.difficulties === "string" ? body.difficulties : draftPayload.difficulties,
  };
  const validated = validatePersonalWeeklyDraft({ currentRows: safe.currentRows, nextRows: safe.nextRows });
  if (!validated.ok || (safe.difficulties !== undefined && typeof safe.difficulties !== "string")) return apiError("invalid_request", 400);
  const result = await completePersonalWeeklyReport(guard.actor.id, { period: safe.period as { start: string; end: string }, periodStart: safe.periodStart as string, draftPayload: { currentRows: validated.value.currentRows, nextRows: validated.value.nextRows }, difficulties: safe.difficulties as string });
  return result.ok ? apiJson({ row: result.data }) : rpcFailure(result.error);
}
