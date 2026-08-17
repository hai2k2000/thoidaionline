import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  const body = await request.json().catch(() => null) as { taskId?: string } | null;
  if (!body?.taskId) return NextResponse.json({ error: "Thiếu công việc cần nhận." }, { status: 400 });
  const { error } = await serverSupabase.rpc("claim_task_plan", { p_actor_id: user.id, p_task_id: body.taskId });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
