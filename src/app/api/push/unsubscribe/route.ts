import { apiError, apiJson, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  if (typeof body?.endpoint !== "string" || !body.endpoint || body.endpoint.length > 4096) return apiError("invalid_request", 400);
  const { error } = await serverSupabase.from("push_subscriptions").delete()
    .eq("user_id", guard.actor.id).eq("kind", "webpush").eq("endpoint", body.endpoint);
  return error ? apiError("operation_failed", 500) : apiJson({ ok: true });
}
