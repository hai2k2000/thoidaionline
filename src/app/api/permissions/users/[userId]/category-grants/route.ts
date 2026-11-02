import { serverSupabase } from "@/lib/serverSupabase";
import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor, rpcFailure } from "@/lib/serverApi";
import { logServerAudit } from "@/lib/serverAudit";

const levels = new Set(["none", "view", "contribute", "approve"]);

export async function PUT(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const actor = await loadRbacActor(guard.actor);
  if (!hasPermission(actor, "permission.manage")) return apiError("forbidden", 403);
  const userId = asUuid((await params).userId);
  const body = await readJsonObject(request);
  const categoryId = asUuid(body?.categoryId);
  const level = typeof body?.level === "string" ? body.level : "";
  if (!userId || !categoryId || !levels.has(level)) return apiError("invalid_request", 400);
  try {
    const [{ data: category, error: categoryError }, { data: previous, error: previousError }] = await Promise.all([
      serverSupabase.from("db_categories").select("id,code,name,restricted,parent_id").eq("id", categoryId).eq("restricted", true).maybeSingle(),
      serverSupabase.from("db_category_access_grants").select("user_id,category_id,level,granted_by,created_at,updated_at").eq("user_id", userId).eq("category_id", categoryId).maybeSingle(),
    ]);
    if (categoryError || previousError) return rpcFailure((categoryError ?? previousError)!);
    if (!category) return apiError("invalid_request", 400);
    if (level === "none") {
      const result = await serverSupabase.from("db_category_access_grants").delete().eq("user_id", userId).eq("category_id", categoryId);
      if (result.error) return rpcFailure(result.error);
    } else {
      const result = await serverSupabase.from("db_category_access_grants").upsert(
        {
          user_id: userId,
          category_id: categoryId,
          level,
          granted_by: guard.actor.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,category_id" },
      );
      if (result.error) return rpcFailure(result.error);
    }
    const auditStatus = await logServerAudit({
      actorId: guard.actor.id,
      module: "admin",
      entityType: "db_category_access_grants",
      entityId: `${userId}:${categoryId}`,
      action: "permission_history.category_grant_update",
      oldData: previous,
      newData: {
        userId,
        categoryId,
        categoryCode: category.code,
        level,
        granted_by: guard.actor.id,
      },
    });
    const response = apiJson({ ok: true, auditStatus });
    response.headers.set("X-Audit-Status", auditStatus);
    return response;
  } catch (error) {
    return rpcFailure(error as { code?: string | null });
  }
}
