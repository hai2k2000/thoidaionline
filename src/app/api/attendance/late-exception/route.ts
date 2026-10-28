import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";

export async function PATCH(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const logId = typeof body?.logId === "string" ? body.logId : "";
  const decision = typeof body?.decision === "string" ? body.decision : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!asUuid(logId) || !["approved", "rejected"].includes(decision) || (decision === "rejected" && note.length < 3) || note.length > 2000) return apiError("invalid_request", 400);
  const result = await serverSupabase.rpc("api_review_late_exception", { p_actor: guard.actor.id, p_log_id: logId, p_decision: decision, p_note: note });
  if (result.error) {
    const status = result.error.code === "40001" ? 409 : result.error.code === "42501" ? 403 : ["22023", "P0002"].includes(result.error.code ?? "") ? 400 : 500;
    return apiError(status === 409 ? "conflict" : status === 403 ? "forbidden" : status === 400 ? "invalid_request" : "operation_failed", status);
  }
  return apiJson({ ok: true, row: result.data });
}
