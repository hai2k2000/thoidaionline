import { apiError, apiJson, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 4096 || /\s/.test(token) || body?.platform !== "android") return apiError("invalid_request", 400);
  const { error } = await serverSupabase.from("push_subscriptions").upsert({
    user_id: guard.actor.id, kind: "fcm", endpoint: token, p256dh: null, auth: null, platform: "android",
    user_agent: (request.headers.get("user-agent") ?? "").slice(0, 500),
    last_seen_at: new Date().toISOString(), failed_count: 0, disabled_at: null,
  }, { onConflict: "kind,endpoint" });
  return error ? apiError("operation_failed", 500) : apiJson({ ok: true });
}
export async function DELETE(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  if (typeof body?.token !== "string" || !body.token || body.token.length > 4096) return apiError("invalid_request", 400);
  const { error } = await serverSupabase.from("push_subscriptions").delete()
    .eq("user_id", guard.actor.id).eq("kind", "fcm").eq("endpoint", body.token);
  return error ? apiError("operation_failed", 500) : apiJson({ ok: true });
}
