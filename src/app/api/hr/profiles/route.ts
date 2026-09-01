import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { logServerAudit } from "@/lib/serverAudit";

const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: NO_STORE });
const canViewAll = (actor: { role_code: string; permissions: { can_edit_all_tasks: boolean } }) => actor.permissions.can_edit_all_tasks || ["admin", "tong_bien_tap", "tbt_read_only", "pho_tong_bien_tap", "phu_trach_phong_tri_su", "phu_trach_phong_phong_vien", "phu_trach_phong_bien_tap"].includes(actor.role_code);
const canEdit = (roleCode: string) => roleCode !== "tbt_read_only" && roleCode !== "tong_bien_tap";

export async function GET(request: Request) {
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, { status: 401 });
  const requestedId = new URL(request.url).searchParams.get("user_id")?.trim() ?? "";
  if (requestedId && requestedId !== actor.id && !canViewAll(actor)) return json({ error: "forbidden" }, { status: 403 });
  const query = serverSupabase.from("employee_profiles").select("*");
  const result = requestedId ? await query.eq("user_id", requestedId) : canViewAll(actor) ? await query : await query.eq("user_id", actor.id);
  if (result.error) return json({ error: "Không thể tải hồ sơ nhân sự." }, { status: 500 });
  return json({ profiles: result.data ?? [] });
}

export async function PUT(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor || !canEdit(actor.role_code)) return json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
  if (!userId || (userId !== actor.id && !canViewAll(actor))) return json({ error: "forbidden" }, { status: 403 });
  const allowed = ["employee_code", "date_of_birth", "gender", "id_number", "address", "join_date", "contract_type", "contract_start", "contract_end", "emergency_contact_name", "emergency_contact_phone", "profile_file_url"] as const;
  const payload: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(body ?? {}, key)) payload[key] = body?.[key] ?? null;
  const { data, error } = await serverSupabase.from("employee_profiles").upsert(payload).select("*").single();
  if (error) return json({ error: "Không thể lưu hồ sơ nhân sự." }, { status: 400 });
  await logServerAudit({ actorId: actor.id, module: "admin", entityType: "employee_profiles", entityId: userId, action: "update", newData: data });
  return json({ profile: data });
}
