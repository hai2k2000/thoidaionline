import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: NO_STORE });
const canAccess = (role: string) => [
  "admin", "tong_bien_tap", "pho_tong_bien_tap", "phu_trach_phong_tri_su", "tri_su", "phu_trach_phong_bien_tap", "phu_trach_phong_phong_vien",
].includes(role);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, { status: 401 });
  if (!canAccess(actor.role_code)) return json({ error: "forbidden" }, { status: 403 });
  const id = (await context.params).id;
  const [document, assignments] = await Promise.all([
    serverSupabase.from("official_documents").select("*").eq("id", id).maybeSingle(),
    serverSupabase.from("document_assignments").select("id,assignee_id,due_date,status,staff_users!document_assignments_assignee_id_fkey(full_name,username)").eq("document_id", id).order("assigned_at", { ascending: false }),
  ]);
  if (document.error || assignments.error) return json({ error: "Không thể tải chi tiết tài liệu." }, { status: 500 });
  if (!document.data) return json({ error: "not_found" }, { status: 404 });
  return json({ document: document.data, assignments: assignments.data ?? [] });
}
