import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { normalizeEvaluationInput } from "@/lib/taskEvaluation";

type EvaluationRequest = {
  taskId?: string; employeeId?: string; rating?: number; effortWeight?: number;
  completion?: string; onTime?: boolean; opinion?: string; checkpointDate?: string; isFinal?: boolean;
};

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  const body = await request.json().catch(() => null) as EvaluationRequest | null;
  if (!body?.taskId || !body.employeeId || body.rating === undefined || body.effortWeight === undefined || !body.completion || !body.checkpointDate || body.onTime === undefined || body.isFinal === undefined) {
    return NextResponse.json({ error: "Dữ liệu đánh giá không đầy đủ." }, { status: 400 });
  }

  const { data: task, error: taskError } = await serverSupabase.from("tasks").select("created_by,reviewer_id").eq("id", body.taskId).maybeSingle();
  if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
  if (!task) return NextResponse.json({ error: "Không tìm thấy công việc." }, { status: 404 });
  const isCreator = task.created_by === user.id;
  const isReviewer = task.reviewer_id === user.id;
  const reviewerRole = ["pho_tong_bien_tap", "phu_trach_phong_tri_su", "phu_trach_phong_phong_vien", "phu_trach_phong_bien_tap"].includes(user.role_code);
  const canSubmit = !["tong_bien_tap", "tbt_read_only"].includes(user.role_code)
    && (user.role_code === "admin" || user.permissions.can_manage_users || isCreator || (isReviewer && reviewerRole));
  if (!canSubmit) return NextResponse.json({ error: "Bạn không có quyền đánh giá công việc này." }, { status: 403 });

  let input;
  try {
    input = normalizeEvaluationInput({
      rating: body.rating,
      effortWeight: body.effortWeight,
      completion: body.completion as "not_done" | "done" | "excellent",
      onTime: body.onTime,
      opinion: body.opinion,
      checkpointDate: body.checkpointDate,
      isFinal: body.isFinal,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dữ liệu đánh giá không hợp lệ." }, { status: 400 });
  }

  const { error } = await serverSupabase.rpc("save_task_evaluation_checkpoint", {
    p_actor_id: user.id,
    p_task_id: body.taskId,
    p_employee_id: body.employeeId,
    p_rating: input.rating,
    p_effort_weight: input.effortWeight,
    p_completion: input.completion,
    p_on_time: input.onTime,
    p_opinion: input.opinion ?? "",
    p_checkpoint_date: input.checkpointDate,
    p_is_final: input.isFinal,
  });
  if (!error) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : error.code === "22023" ? 400 : 500 });
}
