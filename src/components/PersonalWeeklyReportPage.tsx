"use client";

import { useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";

type Row = {
  taskId: string;
  title?: string | null;
  status?: string | null;
  sourceLabel?: string | null;
  sourceLabels?: string[];
  period?: { start: string; end: string };
  resultText?: string;
  commentary?: string;
  [key: string]: unknown;
};

type Report = {
  status?: "DRAFT" | "COMPLETED" | string;
  draft_payload?: { currentRows?: Row[]; nextRows?: Row[]; difficulties?: string } | null;
  [key: string]: unknown;
};

type Initial = {
  period: { current: { start: string; end: string }; next: { start: string; end: string } };
  employee: Record<string, unknown> | null;
  report: Report | null;
  currentRows: Row[];
  nextRows: Row[];
  proposals: Array<Record<string, unknown>>;
  difficulties: string;
  history: Array<Record<string, unknown>>;
};

const control = "min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50";
const dateLabel = (value: string) => value.split("-").reverse().join("/");
const statusLabel = (value: unknown) => ({ done: "Hoàn thành", in_progress: "Đang thực hiện", blocked: "Có vướng mắc", cancelled: "Đã hủy", new: "Mới" }[String(value)] ?? String(value ?? "Chưa cập nhật"));

export default function PersonalWeeklyReportPage({ initial }: { initial: Initial }) {
  const { logout } = useAuth();
  const savedDraft = initial.report?.status === "DRAFT" ? initial.report.draft_payload : null;
  const draftCurrentRows = savedDraft && Object.prototype.hasOwnProperty.call(savedDraft, "currentRows") && Array.isArray(savedDraft.currentRows)
    ? savedDraft.currentRows
    : (initial.currentRows ?? []);
  const draftNextRows = savedDraft && Object.prototype.hasOwnProperty.call(savedDraft, "nextRows") && Array.isArray(savedDraft.nextRows)
    ? savedDraft.nextRows
    : (initial.nextRows ?? []);
  const draftDifficulties = savedDraft && Object.prototype.hasOwnProperty.call(savedDraft, "difficulties") && typeof savedDraft.difficulties === "string"
    ? savedDraft.difficulties
    : (initial.difficulties ?? "");
  const [currentRows, setCurrentRows] = useState<Row[]>(() => draftCurrentRows);
  const [nextRows] = useState<Row[]>(() => draftNextRows);
  const [selectedNext, setSelectedNext] = useState<string[]>(() => draftNextRows.map((row) => row.taskId));
  const [difficulties, setDifficulties] = useState(draftDifficulties);
  const [proposals, setProposals] = useState(initial.proposals ?? []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalBusy, setProposalBusy] = useState(false);
  const completed = initial.report?.status === "COMPLETED";
  const employee = initial.employee ?? {};
  const employeeName = String(employee.full_name ?? "Nhân viên");
  const department = String((employee.departments as { name?: string } | null)?.name ?? employee.department_name ?? "Phòng ban");
  const selectedNextRows = useMemo(() => nextRows.filter((row) => selectedNext.includes(row.taskId)), [nextRows, selectedNext]);

  const updateCurrent = (taskId: string, text: string) => setCurrentRows((rows) => rows.map((row) => row.taskId === taskId ? { ...row, resultText: text, commentary: text } : row));
  const toggleNext = (taskId: string) => setSelectedNext((ids) => ids.includes(taskId) ? ids.filter((id) => id !== taskId) : [...ids, taskId]);
  const payload = () => ({ period: initial.period.current, draftPayload: { currentRows, nextRows: selectedNextRows }, difficulties });

  const saveDraft = async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/reports/weekly", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload()) });
      if (!response.ok) throw new Error("Không thể lưu bản nháp.");
      setMessage("Đã lưu bản nháp.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể lưu bản nháp."); } finally { setBusy(false); }
  };

  const completeReport = async () => {
    if (!window.confirm("Bạn có chắc muốn hoàn thành báo cáo? Báo cáo đã hoàn thành sẽ không thể chỉnh sửa.")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/reports/weekly/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload()) });
      if (!response.ok) throw new Error("Không thể hoàn thành báo cáo.");
      setMessage("Đã hoàn thành báo cáo.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể hoàn thành báo cáo."); } finally { setBusy(false); }
  };

  const createProposal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!proposalTitle.trim()) return;
    setProposalBusy(true); setMessage("");
    try {
      const response = await fetch("/api/work-schedule/personal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planType: "work", workDate: initial.period.next.start, endDate: initial.period.next.start, startTime: "09:00", endTime: "17:00", title: proposalTitle.trim(), participantIds: [] }) });
      if (!response.ok) throw new Error("Không thể tạo đề xuất.");
      const body = await response.json() as { row?: Record<string, unknown> };
      if (body.row) setProposals((rows) => [...rows, body.row!]);
      setProposalTitle(""); setProposalOpen(false); setMessage("Đã gửi đề xuất kế hoạch cá nhân chờ phê duyệt.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể tạo đề xuất."); } finally { setProposalBusy(false); }
  };

  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 lg:flex-row lg:gap-4">
      <AppNav currentPath="/reports/weekly" userLabel={employeeName} onLogout={logout} />
      <main className="min-w-0 flex-1 space-y-3">
        <header className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-700">Báo cáo cá nhân</p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Báo cáo tuần</h1><p className="mt-1 text-sm font-semibold text-slate-600">{employeeName} · {department}</p><p className="mt-1 text-sm text-slate-500">Kỳ hiện tại: {dateLabel(initial.period.current.start)} → {dateLabel(initial.period.current.end)}</p></div>{completed ? <a href={`/api/reports/weekly/docx?periodStart=${encodeURIComponent(initial.period.current.start)}`} className="inline-flex min-h-10 items-center rounded-lg bg-orange-600 px-3 py-2 text-sm font-bold text-white hover:bg-orange-700">Xuất Word</a> : <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">Bản nháp</span>}</div>
        </header>

        <section className="rounded-xl border bg-white p-4 shadow-sm" aria-labelledby="weekly-results-title"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="weekly-results-title" className="text-lg font-bold">I. Kết quả công việc trong tuần</h2><span className="text-sm text-slate-500">{currentRows.length} công việc</span></div>
          {currentRows.length ? <><div className="mt-3 hidden overflow-x-auto rounded-lg border md:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="px-3 py-2">Công việc</th><th className="px-3 py-2">Nguồn</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2">Kết quả / ghi chú</th></tr></thead><tbody>{currentRows.map((row) => <tr key={row.taskId} className="border-t align-top"><td className="px-3 py-3 font-semibold">{row.title ?? row.taskId}</td><td className="px-3 py-3">{row.sourceLabel ?? row.sourceLabels?.join(", ") ?? "—"}</td><td className="px-3 py-3">{statusLabel(row.status)}</td><td className="px-3 py-3"><textarea aria-label={`Kết quả ${row.title ?? row.taskId}`} className={control} rows={2} value={String(row.resultText ?? row.commentary ?? "")} disabled={completed} onChange={(event) => updateCurrent(row.taskId, event.target.value)} /></td></tr>)}</tbody></table></div><div className="mt-3 grid gap-3 md:hidden">{currentRows.map((row) => <article key={row.taskId} className="rounded-lg border p-3"><p className="font-semibold">{row.title ?? row.taskId}</p><p className="mt-1 text-xs text-slate-500">{row.sourceLabel ?? row.sourceLabels?.join(", ") ?? "—"} · {statusLabel(row.status)}</p><textarea aria-label={`Kết quả ${row.title ?? row.taskId}`} className={`${control} mt-2`} rows={3} value={String(row.resultText ?? row.commentary ?? "")} disabled={completed} onChange={(event) => updateCurrent(row.taskId, event.target.value)} /></article>)}</div></> : <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">Chưa có công việc trong kỳ này.</p>}
        </section>

        <section className="rounded-xl border bg-white p-4 shadow-sm" aria-labelledby="weekly-next-title"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 id="weekly-next-title" className="text-lg font-bold">II. Kế hoạch tuần tới</h2><p className="text-sm text-slate-500">{dateLabel(initial.period.next.start)} → {dateLabel(initial.period.next.end)} · tiếp tục công việc đang mở</p></div>{!completed ? <button type="button" onClick={() => setProposalOpen((open) => !open)} className="min-h-10 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-900">+ Thêm đề xuất</button> : null}</div>
          {nextRows.length ? <div className="mt-3 grid gap-2">{nextRows.map((row) => <label key={row.taskId} className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-orange-600" checked={selectedNext.includes(row.taskId)} disabled={completed} onChange={() => toggleNext(row.taskId)} /><span><span className="font-semibold">{row.title ?? row.taskId}</span><span className="mt-0.5 block text-xs text-slate-500">{row.sourceLabel ?? "Công việc tiếp tục"} · {statusLabel(row.status)}</span></span></label>)}</div> : <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">Chưa có công việc đề xuất cho tuần tới.</p>}
          {proposals.length ? <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50/50 p-3"><p className="text-sm font-bold text-orange-950">Đề xuất từ Kế hoạch cá nhân</p><ul className="mt-2 grid gap-1 text-sm">{proposals.map((proposal, index) => <li key={String(proposal.id ?? index)} className="rounded bg-white px-3 py-2">{String(proposal.title ?? proposal.name ?? "Đề xuất kế hoạch")} <span className="text-xs text-slate-500">({String(proposal.approval_status ?? "Chờ phê duyệt")})</span></li>)}</ul></div> : null}
          {proposalOpen && !completed ? <form onSubmit={createProposal} className="mt-3 rounded-lg border border-orange-200 bg-orange-50/40 p-3"><label className="grid gap-1 text-sm font-semibold">Nội dung đề xuất<input className={control} value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} placeholder="Ví dụ: Chuẩn bị chuyên đề tuần tới" maxLength={500} required /></label><div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setProposalOpen(false)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Hủy</button><button type="submit" disabled={proposalBusy} className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{proposalBusy ? "Đang gửi…" : "Gửi đề xuất"}</button></div></form> : null}
        </section>

        <section className="rounded-xl border bg-white p-4 shadow-sm" aria-labelledby="weekly-difficulties-title"><h2 id="weekly-difficulties-title" className="text-lg font-bold">III. Khó khăn, kiến nghị</h2><textarea className={`${control} mt-3`} rows={4} maxLength={10000} disabled={completed} value={difficulties} onChange={(event) => setDifficulties(event.target.value)} placeholder="Ghi lại khó khăn hoặc đề xuất hỗ trợ…" /></section>

        <section className="rounded-xl border bg-white p-4 shadow-sm" aria-labelledby="weekly-history-title"><h2 id="weekly-history-title" className="text-lg font-bold">Lịch sử báo cáo</h2>{initial.history?.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{initial.history.map((item, index) => { const start = String(item.period_start ?? ""); const end = String(item.period_end ?? ""); return <a key={String(item.id ?? index)} href={`/reports/weekly?periodStart=${encodeURIComponent(start)}`} className="rounded-lg border p-3 transition hover:border-orange-300 hover:bg-orange-50"><span className="font-semibold">{dateLabel(start)} → {dateLabel(end)}</span><span className="mt-1 block text-xs text-slate-500">{String(item.status ?? "DRAFT") === "COMPLETED" ? "Đã hoàn thành" : "Bản nháp"}</span></a>; })}</div> : <p className="mt-3 text-sm text-slate-500">Chưa có báo cáo trước đây.</p>}</section>

        {!completed ? <div className="sticky bottom-2 z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur"><span role="status" className="mr-auto text-sm text-slate-600">{message}</span><button type="button" disabled={busy} onClick={() => void saveDraft()} className="min-h-10 rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-bold text-orange-800 disabled:opacity-50">{busy ? "Đang lưu…" : "Lưu nháp"}</button><button type="button" disabled={busy} onClick={() => void completeReport()} className="min-h-10 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Hoàn thành báo cáo</button></div> : <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Báo cáo đã hoàn thành và được lưu trong lịch sử.</p>}
        {completed ? null : message && !initial.report?.status ? null : null}
      </main>
    </div>
  </div>;
}
