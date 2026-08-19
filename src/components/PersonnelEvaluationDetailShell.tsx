"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type { PersonnelEvaluationDetail, PersonnelEvaluationTask, RubricFactor } from "@/lib/evaluationRepository";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import TaskDetailModal from "@/components/TaskDetailModal";

const reviewLabels: Record<string, string> = {
  self_draft: "Chờ Trưởng phòng chấm bước 1",
  awaiting_manager: "Chờ Trưởng phòng hoặc Tổng Biên tập đánh giá",
  awaiting_tbt: "Chờ Tổng Biên tập đánh giá",
  published: "Đã công bố",
};

const difficultyLabels: Record<string, string> = {
  low: "Dễ", medium: "Trung bình", high: "Khó",
  easy: "Dễ", normal: "Trung bình", hard: "Khó",
};
const completionLabels: Record<string, string> = {
  completed: "Hoàn thành", unfinished: "Chưa hoàn thành",
};
const deadlineLabels: Record<string, string> = {
  on_time: "Đúng hạn", overdue: "Quá hạn",
  in_time: "Trong hạn", no_deadline: "Không có thời hạn",
};

function ScoreForm({ detail }: { detail: PersonnelEvaluationDetail }) {
  const router = useRouter(); const { notify } = useActionFeedback();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!detail.allowedAction || !detail.reviewId) return null;
  const action = detail.allowedAction;

  const submit = async (formData: FormData) => {
    setBusy(true);
    setFailed(false);
    const scores = detail.factors.map((factor: RubricFactor) => ({
      factor_code: factor.factor_code,
      score: Number(formData.get(`score-${factor.factor_code}`)),
      comment: String(formData.get(`comment-${factor.factor_code}`) ?? ""),
    }));
    try { const response = await fetch(`/api/evaluations/${detail.reviewId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, scores }),
    });
    if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể gửi đánh giá."));
    notify("success", action === "manager" ? "Đã gửi đánh giá của Trưởng phòng." : "Đã lưu đánh giá của Tổng Biên tập."); router.refresh();
    } catch (error) { setFailed(true); notify("error", errorMessage(error, "Không thể gửi đánh giá.")); } finally { setBusy(false); }
  };

  return (
    <form action={submit} className="mt-4 rounded-xl border bg-orange-50 p-4">
      <h3 className="font-bold">
        {action === "manager"
          ? "Trưởng phòng đánh giá"
          : "Tổng Biên tập đánh giá"}
      </h3>
      <div className="mt-3 grid gap-3">
        {detail.factors.map((factor) => (
          <label key={factor.factor_code} className="grid gap-1 text-sm lg:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] lg:items-center">
            <span>{factor.label} (0–{factor.max_score})</span>
            <input required type="number" min="0" max={factor.max_score} step="0.01" name={`score-${factor.factor_code}`} className="rounded border bg-white px-3 py-2" />
            <input name={`comment-${factor.factor_code}`} placeholder="Nhận xét/bằng chứng" className="rounded border bg-white px-3 py-2" />
          </label>
        ))}
      </div>
      {failed ? <p role="alert" className="mt-2 text-sm text-red-700">Không thể gửi đánh giá. Trạng thái hoặc quyền đã thay đổi.</p> : null}
      <button disabled={busy} className="mt-3 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
        {busy ? "Đang gửi…" : action === "manager" ? "Gửi đánh giá" : "Gửi đánh giá"}
      </button>
    </form>
  );
}

function Detail({ detail }: { detail: PersonnelEvaluationDetail }) {
  const [taskFilter, setTaskFilter] = useState("");
  const [taskLimit, setTaskLimit] = useState(5);
  const [selectedTask, setSelectedTask] = useState<PersonnelEvaluationTask | null>(null);
  useEffect(() => {
    if (!selectedTask) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedTask(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selectedTask]);
  const score = (factorCode: string, stage: string) =>
    detail.scores.find((row) => row.factor_code === factorCode && row.stage === stage);
  const filteredTasks = detail.tasks.filter((task) =>
    !taskFilter || task.completion_status === taskFilter,
  );
  const visibleTasks = filteredTasks.slice(0, taskLimit);

  return (
    <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-orange-600">Chi tiết trong kỳ</p>
        <h2 className="mt-1 text-xl font-bold">{detail.employeeName}</h2>
        <p className="text-sm text-slate-600">{detail.departmentName}</p>
      </div>

      <ScoreForm detail={detail} />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Công việc trong kỳ</h3>
          <select value={taskFilter} onChange={(event) => { setTaskFilter(event.target.value); setTaskLimit(5); }} className="rounded border px-3 py-2 text-sm">
            <option value="">Mọi trạng thái</option><option value="completed">Hoàn thành</option><option value="unfinished">Chưa hoàn thành</option>
          </select>
        </div>
      <div className="mt-2 max-h-[360px] overflow-auto">
        <table className="w-full min-w-[780px] border-collapse text-sm">
          <thead><tr className="border-b text-left text-slate-600"><th className="p-2">STT</th><th className="p-2">Tên công việc</th><th className="p-2">Người phụ trách</th><th className="p-2">Độ khó</th><th className="p-2">Trạng thái hoàn thành</th><th className="p-2">Thời hạn</th></tr></thead>
          <tbody>{visibleTasks.map((task, index) => <tr key={task.id} className="border-b"><td className="p-2">{index + 1}</td><td className="p-2 font-semibold"><button type="button" onClick={() => setSelectedTask(task)} className="text-left text-orange-700 underline">{task.title}</button></td><td className="p-2">{task.assignee_name ?? "—"}</td><td className="p-2">{difficultyLabels[task.difficulty] ?? task.difficulty}</td><td className="p-2">{completionLabels[task.completion_status] ?? task.completion_status}</td><td className="p-2">{deadlineLabels[task.deadline_outcome] ?? task.deadline_outcome}</td></tr>)}</tbody>
        </table>
        {!detail.tasks.length ? <p className="p-5 text-center text-slate-500">Không có công việc trong khoảng ngày đã chọn.</p> : null}
      </div>

      {selectedTask ? <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} /> : null}
        {taskLimit < filteredTasks.length ? <button type="button" onClick={() => setTaskLimit((value) => value + 5)} className="mt-2 rounded border px-3 py-2 text-sm font-semibold">Xem thêm công việc</button> : null}
      </div>

      <div>
        <h3 className="font-bold">Bảng chấm điểm cá nhân</h3>
        <p className="mt-1 text-sm text-slate-600">{detail.reviewStatus ? reviewLabels[detail.reviewStatus] ?? detail.reviewStatus : "Chưa có hồ sơ đánh giá trong kỳ."}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead><tr className="border-b text-left text-slate-600"><th className="p-2">Tiêu chí</th><th className="p-2">Tối đa</th><th className="p-2">Nhân viên</th><th className="p-2">Trưởng phòng</th><th className="p-2">Tổng Biên tập</th></tr></thead>
            <tbody>{detail.factors.map((factor) => <tr key={factor.factor_code} className="border-b"><td className="p-2 font-semibold">{factor.label}</td><td className="p-2">{factor.max_score}</td><td className="p-2">{score(factor.factor_code, "self")?.score ?? "—"}</td><td className="p-2">{score(factor.factor_code, "manager")?.score ?? "—"}</td><td className="p-2">{score(factor.factor_code, "tbt")?.score ?? "—"}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}


export default function PersonnelEvaluationDetailShell({ detail, userLabel, from, to }: {
  detail: PersonnelEvaluationDetail; userLabel: string; from: string; to: string;
}) {
  const router = useRouter();
  const { logout } = useAuth();
  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row lg:gap-6">
      <AppNav currentPath="/evaluations" userLabel={userLabel} onLogout={() => { logout(); router.replace("/login"); }} />
      <main className="min-w-0 flex-1 space-y-4">
        <Link href={`/evaluations?from=${from}&to=${to}`} className="inline-flex rounded-lg border bg-white px-4 py-2 font-semibold text-orange-700">← Quay về danh sách</Link>
        <Detail detail={detail} />
      </main>
    </div>
  </div>;
}
