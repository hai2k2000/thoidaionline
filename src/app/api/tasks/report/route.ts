import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  const body = await request.json().catch(() => null) as { taskId?: unknown; progress?: unknown; report?: unknown; blockers?: unknown } | null;
  const taskId = typeof body?.taskId === "string" ? body.taskId : "";
  const progress = typeof body?.progress === "number" ? body.progress : Number(body?.progress);
  const report = typeof body?.report === "string" ? body.report.trim() : "";
  const blockers = typeof body?.blockers === "string" ? body.blockers.trim() : "";
  if (!taskId || !Number.isInteger(progress) || progress < 0 || progress > 100 || !report) return NextResponse.json({ error: "Dữ liệu báo cáo không hợp lệ." }, { status: 400 });
  const { data, error } = await serverSupabase.rpc("report_task_progress", { p_actor_id: user.id, p_task_id: taskId, p_progress: progress, p_report: report, p_blockers: blockers || null });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : ["22023", "P0002"].includes(error.code ?? "") ? 400 : 500 });
  return NextResponse.json({ ok: true, task: data });
}
