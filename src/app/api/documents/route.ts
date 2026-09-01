import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { logServerAudit } from "@/lib/serverAudit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: NO_STORE });
const canAccess = (role: string) => [
  "admin", "pho_tong_bien_tap", "phu_trach_phong_tri_su", "tri_su", "phu_trach_phong_bien_tap", "phu_trach_phong_phong_vien",
].includes(role);

export async function GET(request: Request) {
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, { status: 401 });
  if (!canAccess(actor.role_code)) return json({ error: "forbidden" }, { status: 403 });
  const options = new URL(request.url).searchParams.get("options") === "1";
  const [documents, users] = await Promise.all([
    serverSupabase.from("official_documents").select("*").order("created_at", { ascending: false }),
    options ? serverSupabase.from("staff_users").select("id,full_name,username").eq("active", true).order("full_name") : Promise.resolve({ data: [], error: null }),
  ]);
  if (documents.error || users.error) return json({ error: "Không thể tải dữ liệu tài liệu." }, { status: 500 });
  return json({ documents: documents.data ?? [], users: users.data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor || !canAccess(actor.role_code)) return json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "create";
  if (action === "assign") {
    const documentId = typeof body?.document_id === "string" ? body.document_id.trim() : "";
    const assigneeId = typeof body?.assignee_id === "string" ? body.assignee_id.trim() : "";
    if (!documentId || !assigneeId) return json({ error: "invalid_request" }, { status: 400 });
    const { data, error } = await serverSupabase.from("document_assignments").insert({ document_id: documentId, assignee_id: assigneeId, assigned_by: actor.id, due_date: typeof body?.due_date === "string" ? body.due_date : null, status: "todo" }).select("*").single();
    if (error) return json({ error: "Không thể giao xử lý tài liệu." }, { status: 400 });
    const { error: documentError } = await serverSupabase.from("official_documents").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", documentId);
    if (documentError) return json({ error: "Tài liệu đã giao nhưng chưa cập nhật trạng thái." }, { status: 500 });
    await logServerAudit({ actorId: actor.id, module: "admin", entityType: "document_assignments", entityId: data.id, action: "assign", newData: data });
    return json({ assignment: data }, { status: 201 });
  }
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const direction = typeof body?.direction === "string" ? body.direction : "";
  if (!title || title.length > 500 || !["incoming", "outgoing", "contract", "common"].includes(direction)) return json({ error: "invalid_request" }, { status: 400 });
  const prefixMap: Record<string, string> = { incoming: "CV-DEN", outgoing: "CV-DI", contract: "HD", common: "TL-CHUNG" };
  const prefix = `${prefixMap[direction]}-${new Date().getFullYear()}-`;
  const { data: latest } = await serverSupabase.from("official_documents").select("doc_code").ilike("doc_code", `${prefix}%`).order("doc_code", { ascending: false }).limit(1).maybeSingle();
  const requestedCode = typeof body?.doc_code === "string" ? body.doc_code.trim().toUpperCase() : "";
  const current = latest?.doc_code ?? `${prefix}0000`;
  const nextCode = `${prefix}${String(Number(current.match(/(\d+)$/)?.[1] ?? "0") + 1).padStart(4, "0")}`;
  const { data, error } = await serverSupabase.from("official_documents").insert({
    doc_code: requestedCode || nextCode, title, direction, urgency: "normal", confidentiality: "normal", status: "new", created_by: actor.id,
  }).select("*").single();
  if (error) return json({ error: "Không thể tạo tài liệu." }, { status: 400 });
  await logServerAudit({ actorId: actor.id, module: "admin", entityType: "official_documents", entityId: data.id, action: "create", newData: data });
  return json({ document: data }, { status: 201 });
}
