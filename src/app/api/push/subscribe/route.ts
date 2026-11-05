import { apiError, apiJson, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { parseWebPushSubscription } from "@/lib/push/subscription.mjs";
export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const subscription = parseWebPushSubscription(await readJsonObject(request));
  if (!subscription) return apiError("invalid_request", 400);
  const { error } = await serverSupabase.from("push_subscriptions").upsert({
    user_id: guard.actor.id, kind: "webpush", endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, platform: "web",
    user_agent: (request.headers.get("user-agent") ?? "").slice(0, 500),
    last_seen_at: new Date().toISOString(), failed_count: 0, disabled_at: null,
  }, { onConflict: "kind,endpoint" });
  return error ? apiError("operation_failed", 500) : apiJson({ ok: true });
}
