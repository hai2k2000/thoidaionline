import { apiError, apiJson, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const platform = typeof body?.platform === "string" ? body.platform.trim().slice(0, 30) : "unknown";
  if (!token || token.length > 4096) return apiError("invalid_request", 400);
  const { error } = await serverSupabase.from("mobile_push_tokens").upsert({
    user_id: guard.actor.id, fcm_token: token, platform, updated_at: new Date().toISOString(),
  }, { onConflict: "fcm_token" });
  return error ? apiError("operation_failed", 500) : apiJson({ ok: true });
}
