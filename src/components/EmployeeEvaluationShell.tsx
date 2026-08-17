"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EvaluationItem, EvaluationPageData, RubricFactor } from "@/lib/evaluationRepository";

const labels: Record<string, string> = { self_draft: "Chờ tự đánh giá", awaiting_manager: "Chờ Trưởng phòng", awaiting_tbt: "Chờ Tổng Biên tập", published: "Đã công bố" };

function ScoreForm({ item, action }: { item: EvaluationItem; action: "self" | "manager" | "tbt" }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const submit = async (formData: FormData) => {
    setBusy(true); setError(false);
    const scores = item.factors.map((factor: RubricFactor) => ({ factor_code: factor.factor_code, score: Number(formData.get(`score-${factor.factor_code}`)), comment: String(formData.get(`comment-${factor.factor_code}`) ?? "") }));
    const response = await fetch(`/api/evaluations/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, scores }) });
    setBusy(false); if (!response.ok) setError(true); else router.refresh();
  };
  return <form action={submit} className="mt-4 rounded-lg border bg-slate-50 p-3">
    <p className="font-semibold">{action === "self" ? "Tự đánh giá" : action === "manager" ? "Trưởng phòng — bước 1" : "Tổng Biên tập — bước 2 và công bố"}</p>
    <div className="mt-3 grid gap-3">{item.factors.map((factor) => <label key={factor.factor_code} className="grid gap-1 text-sm sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)] sm:items-center"><span>{factor.label} (0–{factor.max_score})</span><input required type="number" min="0" max={factor.max_score} step="0.01" name={`score-${factor.factor_code}`} className="rounded border px-2 py-1" /><input name={`comment-${factor.factor_code}`} placeholder="Nhận xét/bằng chứng" className="rounded border px-2 py-1" /></label>)}</div>
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">Không thể lưu đánh giá. Kiểm tra điểm và quyền thao tác.</p> : null}
    <button disabled={busy} className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Đang lưu…" : action === "tbt" ? "Công bố kết quả" : "Gửi đánh giá"}</button>
  </form>;
}

export default function EmployeeEvaluationShell({ data }: { data: EvaluationPageData }) {
  const router = useRouter(); const [creating, setCreating] = useState(false);
  const ownCycleIds = new Set(data.items.filter((item) => item.employeeId === data.currentUserId).map((item) => item.cycleId));
  const start = async (cycleId: string) => { setCreating(true); const response = await fetch("/api/evaluations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cycleId }) }); setCreating(false); if (response.ok) router.refresh(); };
  return <section className="mt-4 space-y-4">
    <form action="/tasks" className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-6">
      <input type="hidden" name="view" value="evaluations" /><input name="from" type="date" aria-label="Từ ngày" className="rounded-lg border px-3 py-2" /><input name="to" type="date" aria-label="Đến ngày" className="rounded-lg border px-3 py-2" />
      <input name="department" placeholder="Phòng ban" className="rounded-lg border px-3 py-2" /><input name="employee" placeholder="Tìm nhân viên" className="rounded-lg border px-3 py-2" />
      <select name="status" className="rounded-lg border px-3 py-2"><option value="">Mọi trạng thái</option>{Object.entries(labels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Lọc</button>
    </form>
    {data.openCycles.filter((cycle) => !ownCycleIds.has(cycle.id)).map((cycle) => <div key={cycle.id} className="rounded-xl border bg-orange-50 p-4"><p className="font-semibold">{cycle.name} · {cycle.start_date}–{cycle.end_date}</p><button disabled={creating} onClick={() => start(cycle.id)} className="mt-2 rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-white">Bắt đầu tự đánh giá</button></div>)}
    {!data.items.length ? <p className="rounded-xl border bg-white p-6 text-center text-slate-600">Không có kỳ đánh giá phù hợp.</p> : null}
    {data.items.map((item) => <article key={item.id} className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{item.employeeName}</h2><p className="text-sm text-slate-600">{item.departmentName} · {item.cycleName} ({item.cycleStart}–{item.cycleEnd})</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{labels[item.status] ?? item.status}</span></div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><dt className="text-slate-500">Tự đánh giá</dt><dd>{item.selfScore ?? "—"}</dd></div><div><dt className="text-slate-500">Bước 1</dt><dd>{item.managerScore ?? "—"}</dd></div><div><dt className="text-slate-500">Kết quả</dt><dd>{item.finalScore ?? "—"}/100</dd></div><div><dt className="text-slate-500">Xếp loại</dt><dd>{item.rank ?? "Chưa công bố"}</dd></div></dl>
      <details className="mt-3"><summary className="cursor-pointer font-semibold">Bằng chứng công việc ({item.evidence.length})</summary><ul className="mt-2 space-y-1">{item.evidence.map((task) => <li key={task.id}><Link className="text-orange-700 underline" href={`/tasks/${task.id}`}>{task.title}</Link> · {task.status}</li>)}</ul></details>
      {item.canSelf ? <ScoreForm item={item} action="self" /> : null}{item.canManager ? <ScoreForm item={item} action="manager" /> : null}{item.canTbt ? <ScoreForm item={item} action="tbt" /> : null}
    </article>)}
    <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Đánh giá cũ — thang 1–10</summary><p className="mt-2 text-sm text-slate-600">Dữ liệu legacy chỉ đọc, không quy đổi hoặc cộng vào thang 100 điểm.</p></details>
  </section>;
}
