import { serverSupabase } from "@/lib/serverSupabase";
import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import { apiError, apiJson, asUuid, requireReadActor, rpcFailure } from "@/lib/serverApi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const userId = asUuid((await params).userId);
  if (!userId) return apiError("invalid_request", 400);
  try {
    const actor = await loadRbacActor(guard.actor);
    if (!hasPermission(actor, "permission.manage")) return apiError("forbidden", 403);
    const [permissions, user, overrides, departments, grants, categoryGrants] = await Promise.all([
      serverSupabase.rpc("api_list_user_approval_permissions", { p_admin: guard.actor.id, p_user: userId }),
      serverSupabase
        .from("staff_users")
        .select(
          "id,full_name,username,active,"
          + "department:departments!staff_users_department_id_fkey(id,name),"
          + "job_title:job_titles!staff_users_job_title_id_fkey(name),"
          + "role:roles!staff_users_role_id_fkey(code,name,active)",
        )
        .eq("id", userId)
        .maybeSingle(),
      serverSupabase.from("user_permission_grants").select("permission_id", { count: "exact", head: true }).eq("user_id", userId),
      serverSupabase.from("departments").select("id,name").eq("active", true).order("name"),
      serverSupabase.from("db_department_view_grants").select("department_id").eq("user_id", userId),
      serverSupabase
        .from("db_categories")
        .select("id,code,name,restricted,parent_id,sort_order,db_category_access_grants!left(level)")
        .eq("restricted", true)
        .eq("db_category_access_grants.user_id", userId)
        .order("sort_order"),
    ]);
    if (permissions.error) return rpcFailure(permissions.error);
    if (user.error) return rpcFailure(user.error);
    if (!user.data) return apiError("not_found", 404);
    if (overrides.error) return rpcFailure(overrides.error);
    if (departments.error || grants.error || categoryGrants.error) return rpcFailure((departments.error ?? grants.error ?? categoryGrants.error)!);
    const parentIds = [...new Set((categoryGrants.data ?? []).map((category) => category.parent_id).filter(Boolean))] as string[];
    const parentCategories = parentIds.length
      ? await serverSupabase.from("db_categories").select("id,name,sort_order").in("id", parentIds)
      : { data: [], error: null };
    if (parentCategories.error) return rpcFailure(parentCategories.error);
    const parentCategoryById = new Map((parentCategories.data ?? []).map((category) => [category.id, category]));
    const categoryGrantItems = (categoryGrants.data ?? [])
      .map((category) => {
        const parentCategory = category.parent_id ? parentCategoryById.get(category.parent_id) : null;
        return {
          category,
          parentCategory,
          parentSortOrder: parentCategory?.sort_order ?? category.sort_order ?? 0,
        };
      })
      .sort((left, right) => left.parentSortOrder - right.parentSortOrder || (left.parentCategory ? left.category.sort_order ?? 0 : -1) - (right.parentCategory ? right.category.sort_order ?? 0 : -1) || left.category.name.localeCompare(right.category.name));
    return apiJson({
      user: { ...(user.data as unknown as Record<string, unknown>), override_count: overrides.count ?? 0 },
      items: permissions.data ?? [],
      departments: departments.data ?? [],
      departmentViewGrants: (grants.data ?? []).map((row) => row.department_id),
      categoryGrants: categoryGrantItems.map(({ category, parentCategory }) => ({
        category_id: category.id,
        level: category.db_category_access_grants?.[0]?.level ?? "none",
        db_categories: {
          code: category.code,
          name: parentCategory ? `${parentCategory.name} › ${category.name}` : category.name,
          restricted: category.restricted,
        },
      })),
    });
  } catch (error) { return rpcFailure(error as { code?: string | null }); }
}
