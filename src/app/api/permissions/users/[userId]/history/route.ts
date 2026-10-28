import { serverSupabase } from "@/lib/serverSupabase";
import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import { apiError, apiJson, asUuid, requireReadActor, rpcFailure } from "@/lib/serverApi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const userId = asUuid((await params).userId);
  if (!userId) return apiError("invalid_request", 400);
  const query = new URL(request.url).searchParams;
  const rawLimit = query.get("limit");
  const parsedLimit = rawLimit === null ? 30 : Number(rawLimit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) return apiError("invalid_request", 400);
  const limit = Math.min(parsedLimit, 100);
  const beforeValue = query.get("before");
  const before = beforeValue === null ? null : new Date(beforeValue);
  if (beforeValue !== null && (before === null || Number.isNaN(before.valueOf()))) return apiError("invalid_request", 400);
  try {
    const actor = await loadRbacActor(guard.actor);
    if (!hasPermission(actor, "permission.manage")) return apiError("forbidden", 403);
    const result = await serverSupabase.rpc("api_list_user_permission_history", { p_admin: guard.actor.id, p_user: userId, p_limit: limit, p_before: before?.toISOString() ?? null });
    if (result.error) return rpcFailure(result.error);
    const items = Array.isArray(result.data) ? result.data : [];
    return apiJson({ items, nextBefore: items.length === limit ? items.at(-1)?.createdAt ?? null : null });
  } catch (error) { return rpcFailure(error as { code?: string | null }); }
}
