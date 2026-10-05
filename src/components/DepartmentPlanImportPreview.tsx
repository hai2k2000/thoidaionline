"use client";

import { useMemo, useState } from "react";
import { candidateKey, summarizeImportCandidates } from "@/lib/departmentPlanImportPreview.mjs";

type DuplicateDecision = "merge" | "separate" | "skip" | null;
type Candidate = {
  rowNumber?: number; taskId?: string | null; title: string; assigneeName?: string | null;
  assigneeIds?: string[]; mappingConfidence?: "HIGH" | "REVIEW" | "UNRESOLVED";
  dueDate?: string | null; duplicateRequiresConfirmation?: boolean; warning?: string | null;
  existingTask?: { id: string; title: string } | null;
};

type Props = {
  candidates: Candidate[];
  decisions: Record<string, DuplicateDecision>;
  busy: boolean;
  onDecision: (key: string, decision: Exclude<DuplicateDecision, null>) => void;
  onClose: () => void;
  onConfirm: () => void;
};

const dateLabel = (value?: string | null) => value ? value.split("-").reverse().join("/") : "Chưa có hạn";
const assigneeLabel = (item: Candidate) => item.mappingConfidence === "HIGH" && item.assigneeName ? item.assigneeName : "Chưa phân công";

export default function DepartmentPlanImportPreview({ candidates, decisions, busy, onDecision, onClose, onConfirm }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const summary = useMemo(() => summarizeImportCandidates(candidates, decisions), [candidates, decisions]);
  const normalRows = candidates.filter((item) => !item.duplicateRequiresConfirmation);
  const duplicateRows = candidates.filter((item) => item.duplicateRequiresConfirmation);
  const renderRow = (item: Candidate, conflict = false) => {
    const key = candidateKey(item);
    return <article key={key} className={`rounded-xl border p-4 ${conflict ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold text-slate-900">{item.title}</h3><p className="mt-1 text-sm text-slate-600">Người thực hiện: <span className="font-semibold text-slate-800">{assigneeLabel(item)}</span></p><p className="text-sm text-slate-600">Hạn: {dateLabel(item.dueDate)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${conflict ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>{conflict ? "Có khả năng trùng" : item.mappingConfidence === "HIGH" ? "Sẽ thêm và giao việc" : "Sẽ thêm vào kế hoạch"}</span></div>
      {conflict ? <div className="mt-3"><p className="text-sm font-semibold text-amber-900">{item.existingTask ? `Khớp với: ${item.existingTask.title}` : item.warning ?? "Cần xác nhận cách xử lý dòng này."}</p><div className="mt-3 flex flex-wrap gap-2">{[["merge", "Gộp với công việc hiện có"], ["separate", "Giữ là công việc riêng"], ["skip", "Bỏ qua"]].map(([value, label]) => <button key={value} type="button" onClick={() => onDecision(key, value as Exclude<DuplicateDecision, null>)} className={`rounded-lg border px-3 py-2 text-sm font-bold ${decisions[key] === value ? "border-orange-600 bg-orange-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-orange-300"}`}>{label}</button>)}</div></div> : null}
    </article>;
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><section className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="department-plan-import-preview-title">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-700">XEM TRƯỚC IMPORT KẾ HOẠCH</p><h2 id="department-plan-import-preview-title" className="mt-1 text-xl font-extrabold text-slate-950">{summary.total} công việc được đọc từ Excel</h2></div><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border px-3 py-1.5 text-sm font-bold text-slate-700">Đóng</button></div>
    <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><p className="font-semibold text-emerald-800">✓ {summary.newRows} công việc mới — sẽ thêm</p><p className="font-semibold text-emerald-800">✓ {summary.mappedRows} công việc đã xác định người thực hiện — sẽ giao việc</p><p className={summary.duplicateRows ? "font-semibold text-amber-800" : "font-semibold text-slate-600"}>⚠ {summary.duplicateRows} công việc có khả năng trùng {summary.duplicateRows ? "— cần xác nhận" : ""}</p></div>
    {duplicateRows.length ? <div className="mt-4 grid gap-3" aria-label="Dòng cần xác nhận">{duplicateRows.map((item) => renderRow(item, true))}</div> : null}
    <div className="mt-4"><button type="button" onClick={() => setShowDetails((current) => !current)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700">{showDetails ? "Ẩn chi tiết" : "Hiện chi tiết"}</button></div>
    {showDetails ? <div className="mt-3 grid gap-3" aria-label="Chi tiết dòng import">{normalRows.map((item) => renderRow(item))}</div> : null}
    <footer className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Hủy</button><button type="button" onClick={onConfirm} disabled={busy || summary.unresolvedDuplicateRows > 0} className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang import…" : "Xác nhận và import"}</button></footer>
  </section></div>;
}