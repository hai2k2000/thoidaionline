import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  const body = await request.json().catch(() => null) as { taskId?: unknown; decision?: unknown; note?: unknown } | null;
  const taskId = typeof body?.taskId === "string" ? body.taskId : "";
  const decision = body?.decision === "approve" || body?.decision === "reject" ? body.decision : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!taskId || !decision) return NextResponse.json({ error: "Thiếu quyết định duyệt." }, { status: 400 });
  const { data, error } = await serverSupabase.rpc("review_task_completion", { p_actor_id: user.id, p_task_id: taskId, p_decision: decision, p_note: note || null });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : ["22023", "P0002"].includes(error.code ?? "") ? 400 : 500 });
  return NextResponse.json({ ok: true, task: data });
}
