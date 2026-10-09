import { apiError, apiJson, readJsonObject, requireMutationActor, rpcFailure } from "@/lib/serverApi";
import { loadPersonalWeeklyReport, savePersonalWeeklyDraft } from "@/lib/personalWeeklyReportService";
import { validatePersonalWeeklyDraft } from "@/lib/personalWeeklyReport";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await loadPersonalWeeklyReport(request);
  return result.ok ? apiJson(result.data) : result.response;
}

function draftOnly(body: Record<string, unknown>) {
  const draftPayload = body.draftPayload && typeof body.draftPayload === "object" && !Array.isArray(body.draftPayload)
    ? body.draftPayload as Record<string, unknown>
    : {};
  return {
    period: body.period,
    periodStart: body.periodStart,
    currentRows: Array.isArray(body.currentRows) ? body.currentRows : draftPayload.currentRows,
    nextRows: Array.isArray(body.nextRows) ? body.nextRows : draftPayload.nextRows,
    excludedTaskIds: Array.isArray(body.excludedTaskIds) ? body.excludedTaskIds : draftPayload.excludedTaskIds,
    difficulties: typeof body.difficulties === "string" ? body.difficulties : draftPayload.difficulties,
  };
}

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  if (!body) return apiError("invalid_request", 400);
  const input = draftOnly(body);
  const validated = validatePersonalWeeklyDraft({ currentRows: input.currentRows, nextRows: input.nextRows });
  if (!validated.ok || (input.difficulties !== undefined && typeof input.difficulties !== "string")) return apiError("invalid_request", 400);
  const result = await savePersonalWeeklyDraft(guard.actor.id, { period: input.period as { start: string; end: string }, periodStart: input.periodStart as string, draftPayload: { currentRows: validated.value.currentRows, nextRows: validated.value.nextRows, excludedTaskIds: Array.isArray(input.excludedTaskIds) ? input.excludedTaskIds.filter((id): id is string => typeof id === "string") : [] }, difficulties: input.difficulties as string });
  return result.ok ? apiJson({ row: result.data }) : rpcFailure(result.error);
}
