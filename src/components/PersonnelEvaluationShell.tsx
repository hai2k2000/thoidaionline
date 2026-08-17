"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type {
  PersonnelEvaluationData,
  PersonnelEvaluationDetail,
  RubricFactor,
} from "@/lib/evaluationRepository";

const reviewLabels: Record<string, string> = {
  self_draft: "Chờ nhân viên tự đánh giá",
  awaiting_manager: "Chờ Trưởng phòng chấm bước 1",
  awaiting_tbt: "Chờ Tổng Biên tập chấm bước 2",
  published: "Đã công bố",
};

const difficultyLabels: Record<string, string> = {
  low: "Dễ",
  medium: "Trung bình",
  high: "Khó",
  easy: "Dễ",
  normal: "Trung bình",
  hard: "Khó",
};

const completionLabels: Record<string, string> = {
  completed: "Hoàn thành",
  unfinished: "Chưa hoàn thành",
};

const deadlineLabels: Record<string, string> = {
  on_time: "Đúng hạn",
  overdue: "Quá hạn",
  in_time: "Trong hạn",
  no_deadline: "Không có thời hạn",
};

function ScoreForm({ detail }: { detail: PersonnelEvaluationDetail }) {
  const router = useRouter();
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
    const response = await fetch(`/api/evaluations/${detail.reviewId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, scores }),
    });
    setBusy(false);
    if (!response.ok) setFailed(true);
    else router.refresh();
  };

  return (
    <form action={submit} className="mt-4 rounded-xl border bg-orange-50 p-4">
      <h3 className="font-bold">
        {action === "manager"
          ? "Trưởng phòng chấm bước 1"
          : "Tổng Biên tập chấm bước 2 và công bố"}
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
        {busy ? "Đang gửi…" : action === "manager" ? "Gửi bước 1" : "Công bố bước 2"}
      </button>
    </form>
  );
}

function Detail({ detail }: { detail: PersonnelEvaluationDetail }) {
  const score = (factorCode: string, stage: string) =>
    detail.scores.find((row) => row.factor_code === factorCode && row.stage === stage);

  return (
    <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-orange-600">Chi tiết trong kỳ</p>
        <h2 className="mt-1 text-xl font-bold">{detail.employeeName}</h2>
        <p className="text-sm text-slate-600">{detail.departmentName}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-sm">
          <thead><tr className="border-b text-left text-slate-600"><th className="p-2">STT</th><th className="p-2">Tên công việc</th><th className="p-2">Độ khó</th><th className="p-2">Trạng thái hoàn thành</th><th className="p-2">Thời hạn</th></tr></thead>
          <tbody>{detail.tasks.map((task, index) => <tr key={task.id} className="border-b"><td className="p-2">{index + 1}</td><td className="p-2 font-semibold"><Link className="text-orange-700 underline" href={`/tasks/${task.id}`}>{task.title}</Link></td><td className="p-2">{difficultyLabels[task.difficulty] ?? task.difficulty}</td><td className="p-2">{completionLabels[task.completion_status] ?? task.completion_status}</td><td className="p-2">{deadlineLabels[task.deadline_outcome] ?? task.deadline_outcome}</td></tr>)}</tbody>
        </table>
        {!detail.tasks.length ? <p className="p-5 text-center text-slate-500">Không có công việc trong khoảng ngày đã chọn.</p> : null}
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
      <ScoreForm detail={detail} />
    </section>
  );
}

export default function PersonnelEvaluationShell({ data, invalidFilters, loadFailed, userLabel }: {
  data: PersonnelEvaluationData;
  invalidFilters: boolean;
  loadFailed: boolean;
  userLabel: string;
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const onLogout = () => { logout(); router.replace("/login"); };

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row lg:gap-6">
        <AppNav currentPath="/evaluations" userLabel={userLabel} onLogout={onLogout} />
        <main className="min-w-0 flex-1 space-y-4">
          <header className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-600">ĐÁNH GIÁ NHÂN SỰ</p>
            <h1 className="mt-1 text-2xl font-bold">Nhân viên trực thuộc</h1>
            <p className="mt-1 text-sm text-slate-600">Chọn nhân viên để xem công việc trong kỳ và thực hiện bước chấm được phân quyền.</p>
          </header>

          <form action="/evaluations" className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-semibold">Ngày bắt đầu<input name="from" type="date" required defaultValue={data.from} className="rounded-lg border px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">Ngày kết thúc<input name="to" type="date" required defaultValue={data.to} className="rounded-lg border px-3 py-2 font-normal" /></label>
            <button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Lọc</button>
            <Link href="/evaluations" className="rounded-lg border px-4 py-2 text-center font-semibold">Đặt lại</Link>
          </form>
          {invalidFilters ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">Khoảng ngày không hợp lệ. Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p> : null}
          {loadFailed ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">Không thể tải dữ liệu đánh giá.</p> : null}

          <section className="overflow-hidden rounded-xl border bg-white p-4 shadow-sm">
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-sm">
              <thead><tr className="border-b text-left text-slate-600"><th className="p-2">STT</th><th className="p-2">Nhân viên</th><th className="p-2">Phòng ban</th><th className="p-2">Vai trò</th><th className="p-2">Trạng thái đánh giá</th></tr></thead>
              <tbody>{data.subjects.map((person, index) => <tr key={person.employeeId} className="border-b"><td className="p-2">{index + 1}</td><td className="p-2 font-semibold"><Link className="text-orange-700 underline" href={`/evaluations?from=${data.from}&to=${data.to}&employee=${person.employeeId}`}>{person.employeeName}</Link></td><td className="p-2">{person.departmentName}</td><td className="p-2">{person.isDepartmentManager ? "Trưởng phòng" : "Nhân viên"}</td><td className="p-2">{person.reviewStatus ? reviewLabels[person.reviewStatus] ?? person.reviewStatus : "Chưa có hồ sơ"}</td></tr>)}</tbody>
            </table></div>
            {!data.subjects.length && !invalidFilters && !loadFailed ? <p className="p-6 text-center text-slate-500">Không có nhân viên trong phạm vi đánh giá.</p> : null}
          </section>
          {data.detail ? <Detail detail={data.detail} /> : null}
        </main>
      </div>
    </div>
  );
}
