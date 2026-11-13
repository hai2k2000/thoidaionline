"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { appendNextWeekPlanTasks, currentReportWeek, nextWeekAfterReportDate, planFromReportModel, validateNextWeekPlan, reportSummary, selectTaskListReportModel, taskListReportHref, taskListReportDocxFilename } from "@/lib/taskListReport.mjs";
import type { TaskListReportModel } from "@/lib/taskListReport.mjs";
import type { TaskListQuery } from "@/lib/taskContracts";

type Range = { from: string; to: string };
type PlanItem = { content: string; assignee: string; dueDate: string };
const control = "min-h-11 min-w-0 rounded-lg border border-border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 disabled:opacity-50";
const action = control + " font-semibold";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi");

function ReportPreview({ model }: { model: TaskListReportModel }) {
  return <article aria-label="Bản xem trước báo cáo" className="min-w-0 bg-white p-3 text-black shadow-sm sm:p-6" style={{ fontFamily: '"Times New Roman", serif' }}>
    <div className="grid grid-cols-[0.9fr_1.1fr] gap-3 text-center text-xs sm:text-sm">
      <p className="font-bold">TẠP CHÍ THỜI ĐẠI</p>
      <div><p className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p><p>Độc lập - Tự do - Hạnh phúc</p></div>
    </div>
    <h3 className="mt-6 text-center text-lg font-bold">BÁO CÁO CÔNG VIỆC</h3>
    {model.filterLabel ? <p className="mt-4 break-words text-sm">Bộ lọc: {model.filterLabel}</p> : null}
    <p className="mt-2 text-sm font-bold">{reportSummary(model.counts)}</p>
    <section className="mt-5 min-w-0">
      <h4 className="mb-2 font-bold">{model.generalInfo.title}</h4>
      {model.generalInfo.lines.map(line => <p key={line} className="text-sm">{line}</p>)}
    </section>
    {model.sections.map(section => <section key={section.key} className="mt-5 min-w-0">
      <h4 className="mb-2 font-bold">{section.title}</h4>
      <div tabIndex={0} role="region" aria-label={`Bảng ${section.title}`} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-orange-700">
        <table className="w-full min-w-[600px] table-fixed border-collapse text-left text-xs sm:text-sm">
          <colgroup>{[5, 35, 60].map((width, i) => <col key={i} style={{ width: width + "%" }} />)}</colgroup>
          <thead><tr>{["STT", "Tên công việc", "Kết quả/Ghi chú"].map(title => <th key={title} scope="col" className="border border-slate-400 p-1.5">{title}</th>)}</tr></thead>
          <tbody>{section.rows.map((row, index) => <tr key={row.id}>{[index + 1, row.title, row.statusNote].map((value, column) => <td key={column} className="break-words whitespace-pre-line border border-slate-400 p-1.5 align-top">{value}</td>)}</tr>)}{!section.rows.length ? <tr><td colSpan={3} className="border border-slate-400 p-2">Không có công việc.</td></tr> : null}</tbody>
        </table>
      </div>
    </section>)}
    <NextWeekPlanPreview plan={model.nextWeekPlan} />
    <p className="mt-8 text-center font-bold">NGƯỜI LẬP</p>
    <p className="mt-8 text-center">{model.userName}</p>
  </article>;
}

function NextWeekPlanPreview({ plan }: { plan: TaskListReportModel["nextWeekPlan"] }) {
  return (
    <section className="mt-5 min-w-0">
      <h4 className="mb-2 font-bold">{plan.title}</h4>
      <p className="text-sm">{plan.periodLabel}</p>
      <div tabIndex={0} role="region" aria-label={`Bảng ${plan.title}`} className="mt-2 overflow-x-auto focus-visible:outline-2 focus-visible:outline-orange-700">
        {plan.rows.length ? <table className="w-full min-w-[520px] table-fixed border-collapse text-left text-xs sm:text-sm">
          <colgroup>{[5, 50, 28, 17].map((width, i) => <col key={i} style={{ width: width + "%" }} />)}</colgroup>
          <thead><tr>{plan.headers.map(title => <th key={title} scope="col" className="border border-slate-400 p-1.5">{title}</th>)}</tr></thead>
          <tbody>{plan.rows.map(row => <tr key={row[0]}>{row.map((value, column) => <td key={column} className="break-words whitespace-pre-line border border-slate-400 p-1.5 align-top">{value}</td>)}</tr>)}</tbody>
        </table> : <p>{plan.emptyText}</p>}
      </div>
    </section>
  );
}

export default function TaskListReportDialog({ query, onClose }: { query: TaskListQuery; onClose: () => void }) {
  const [filters] = useState(query);
  const [dates, setDates] = useState<Range>(() => currentReportWeek());
  const [planDates, setPlanDates] = useState<Range>(() => nextWeekAfterReportDate(currentReportWeek().to) ?? currentReportWeek());
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [model, setModel] = useState<TaskListReportModel | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<AbortController | null>(null);
  const titleId = useId();
  const searchId = useId();
  const peopleId = useId();
  const planErrorId = useId();
  const selectedModel = useMemo(() => model ? selectTaskListReportModel(model, selectedIds) : null, [model, selectedIds]);
  const planResult = useMemo(() => validateNextWeekPlan({ ...planDates, items: planItems }, dates.to), [planDates, planItems, dates.to]);
  const preview = useMemo(() => selectedModel && planResult.ok ? planFromReportModel(selectedModel, planResult.plan) : null, [selectedModel, planResult]);
  const selectedCount = selectedModel?.counts.total ?? 0;
  const stale = !model || model.from !== dates.from || model.to !== dates.to;
  const invalidDates = !dates.from || !dates.to || dates.from > dates.to;

  const load = useCallback(async (range: Range) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError(""); setDownloadError(""); setModel(null); setSelectedIds([]);
    try {
      const response = await fetch(taskListReportHref(filters, range).replace("/docx?", "/preview?"), { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Không thể tải bản xem trước. Vui lòng thử lại.");
      if (controller.signal.aborted) return;
      const report = body as TaskListReportModel;
      setModel(report);
      setSelectedIds(report.sections.flatMap(section => section.rows.map(row => row.id)));
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải bản xem trước.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { pending.current?.abort(); element?.close(); document.body.style.overflow = overflow; opener?.focus(); };
  }, []);
  useEffect(() => {
    // Start after mount; abort prevents a superseded response from replacing the selection.
    const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) void load(currentReportWeek()); });
    return () => { controller.abort(); pending.current?.abort(); };
  }, [load]);

  const select = (ids: string[], checked: boolean) => {
    setSelectedIds(current => checked ? [...new Set([...current, ...ids])] : current.filter(id => !ids.includes(id)));
    setDownloadError("");
  };
  const download = async () => {
    if (!model || selectedCount === 0 || stale || loading || busy || !planResult.ok) return;
    setBusy(true); setDownloadError("");
    try {
      const response = await fetch("/api/tasks/report/docx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filters, from: model.from, to: model.to, ids: selectedIds, nextWeekPlan: planResult.plan }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Không thể xuất báo cáo công việc. Vui lòng thử lại.");
      }
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href; link.download = taskListReportDocxFilename(model.from, model.to, model.userName);
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (cause) { setDownloadError(cause instanceof Error ? cause.message : "Không thể xuất báo cáo công việc."); }
    finally { setBusy(false); }
  };
  const allIds = model?.sections.flatMap(section => section.rows.map(row => row.id)) ?? [];
  const needle = normalize(search.trim());
  const matches = (row: { title: string; assignees: string }) => normalize(row.title + " " + row.assignees).includes(needle);
  const hasMatches = model?.sections.some(section => section.rows.some(matches));
  const people = [...new Set(model?.sections.flatMap(section => section.rows.flatMap(row => row.assignees.split(", "))).filter(value => value && value !== "Chưa phân công") ?? [])];
  const updatePlanItem = (index: number, patch: Partial<PlanItem>) => setPlanItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const addPlanItem = () => setPlanItems(current => current.length >= 100 ? current : [...current, { content: "", assignee: "", dueDate: "" }]);
  const removePlanItem = (index: number) => setPlanItems(current => current.filter((_, itemIndex) => itemIndex !== index));
  const movePlanItem = (index: number, delta: number) => setPlanItems(current => { const next = index + delta; if (next < 0 || next >= current.length) return current; const copy = [...current]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy; });
  const quickAdd = () => { if (!selectedModel) return; setPlanItems(current => appendNextWeekPlanTasks(current, selectedModel)); };

  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }} className="mobile-dialog-overlay inset-0 z-[120] place-items-center bg-slate-950/55 p-4 open:grid" style={{ position: "fixed", margin: 0, width: "100%", maxWidth: "none", height: "100dvh", maxHeight: "none", border: 0 }}>
    <section className="flex max-h-[92dvh] w-full min-w-0 max-w-7xl flex-col overflow-hidden rounded-[var(--radius-sheet)] border border-border bg-surface text-text shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div><h2 id={titleId} className="text-lg font-bold text-brand-ink">Xuất báo cáo công việc</h2><p className="mt-1 text-sm text-text-muted">Chọn công việc và xem nội dung trước khi tải. Tối đa 1.000 công việc theo bộ lọc hiện tại.</p></div>
        <button type="button" disabled={busy} onClick={onClose} className={action} aria-label="Đóng xuất báo cáo">Đóng</button>
      </header>
      <div className="min-h-0 min-w-0 overflow-y-auto">
        <form onSubmit={event => { event.preventDefault(); if (!invalidDates) void load(dates); }} className="grid grid-cols-1 items-end gap-3 border-b border-border p-4 sm:grid-cols-[1fr_1fr_auto] sm:px-6">
          <label className="grid min-w-0 gap-1 text-sm font-semibold">Từ ngày<input type="date" required value={dates.from} max={dates.to} disabled={busy} onChange={event => setDates({ ...dates, from: event.target.value })} className={control + " w-full"} /></label>
          <label className="grid min-w-0 gap-1 text-sm font-semibold">Đến ngày<input type="date" required value={dates.to} min={dates.from} disabled={busy} onChange={event => { const to = event.target.value; setDates({ ...dates, to }); const next = nextWeekAfterReportDate(to); if (next) setPlanDates(next); }} className={control + " w-full"} /></label>
          <button type="submit" disabled={invalidDates || loading || busy} className={action + " bg-orange-50 text-orange-800"}>Xem trước</button>
          {model && stale ? <p role="status" className="text-sm text-amber-800 sm:col-span-3">Khoảng ngày đã đổi. Nhấn “Xem trước” để cập nhật trước khi tải.</p> : null}
        </form>
        {loading ? <div className="p-6"><LoadingState label="Đang tải bản xem trước…" /></div> : error ? <div className="p-4"><ErrorState message={error} onRetry={() => void load(dates)} /></div> : model && selectedModel ? <div className="grid min-w-0 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]">
          <aside aria-label="Chọn công việc để xuất" className="min-w-0 border-b border-border p-4 lg:border-r lg:border-b-0">
            <p role="status" aria-live="polite" className="font-bold text-brand-ink">Đã chọn {selectedCount}/{model.counts.total}</p>
            <div className="my-3 flex flex-wrap gap-2"><button type="button" disabled={busy || !allIds.length} onClick={() => select(allIds, true)} className={action}>Chọn tất cả</button><button type="button" disabled={busy || !selectedCount} onClick={() => select(allIds, false)} className={action}>Bỏ chọn</button></div>
            <label htmlFor={searchId} className="text-sm font-semibold">Tìm công việc hoặc người thực hiện</label>
            <input id={searchId} type="search" value={search} onChange={event => setSearch(event.target.value)} className={control + " mt-1 w-full"} placeholder="Nhập từ khóa…" />
            <div className="mt-4 max-h-[45dvh] space-y-4 overflow-y-auto lg:max-h-[60dvh]">
              {!model.counts.total ? <EmptyState title="Không có công việc trong khoảng ngày này" description="Thử chọn khoảng ngày khác hoặc thay đổi bộ lọc công việc." /> : !hasMatches ? <EmptyState title="Không tìm thấy công việc" description="Thử từ khóa khác. Các lựa chọn hiện tại vẫn được giữ." /> : model.sections.map(section => {
                const rows = section.rows;
                const visible = rows.filter(matches);
                const ids = rows.map(row => row.id);
                if (!visible.length && needle) return null;
                return <fieldset key={section.key} disabled={busy} className="min-w-0 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-bold">{section.title} ({rows.length})</legend>
                  <div className="mb-2 flex flex-wrap gap-2"><button type="button" disabled={!ids.length} onClick={() => select(ids, true)} className={action} aria-label={`Chọn tất cả: ${section.title}`}>Chọn tất cả</button><button type="button" disabled={!ids.some(id => selectedIds.includes(id))} onClick={() => select(ids, false)} className={action} aria-label={`Bỏ chọn: ${section.title}`}>Bỏ chọn</button></div>
                  {visible.map(row => <label key={row.id} className="flex min-h-11 cursor-pointer items-start gap-3 border-t border-border py-3 text-sm"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={event => select([row.id], event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-orange-700" /><span className="min-w-0 break-words"><span className="block font-semibold">{row.title}</span><span className="mt-1 block text-xs text-text-muted">{row.assignees} · {row.due}</span></span></label>)}
                  {!rows.length ? <p className="text-sm text-text-muted">Không có công việc.</p> : null}
                </fieldset>;
              })}
            </div>
          </aside>
          <div className="min-w-0 bg-slate-100 p-3 sm:p-5"><h3 className="mb-3 text-sm font-semibold text-text-muted">Xem trước · {selectedCount} công việc</h3>{preview ? <ReportPreview model={preview} /> : <p className="text-sm text-amber-800">Sửa kế hoạch tuần sau để cập nhật bản xem trước.</p>}</div>
          <section className="border-t border-border p-4 sm:p-6 lg:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-base font-bold text-brand-ink">III. Kế hoạch tuần sau</h3><p className="mt-1 text-sm text-text-muted">Dòng trống sẽ không được đưa vào báo cáo. Tối đa 100 dòng; lấy nhanh đến khi đủ 100 dòng.</p></div><button type="button" disabled={busy || stale || planItems.length >= 100} onClick={quickAdd} className={action}>Lấy các việc đang làm/quá hạn</button></div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Từ ngày<input type="date" value={planDates.from} max={planDates.to} disabled={busy} onChange={event => setPlanDates({ ...planDates, from: event.target.value })} className={control} /></label><label className="grid gap-1 text-sm font-semibold">Đến ngày<input type="date" value={planDates.to} min={planDates.from} disabled={busy} onChange={event => setPlanDates({ ...planDates, to: event.target.value })} className={control} /></label></div>
            <div className="mt-3 space-y-3">{planItems.map((item, index) => <fieldset key={index} disabled={busy} className="min-w-0 rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-bold">Dòng {index + 1}</legend>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label className="grid min-w-0 gap-1 text-sm font-semibold">Nội dung công việc <span className="font-normal text-text-muted">(bắt buộc, {item.content.length}/1000)</span><textarea required maxLength={1000} value={item.content} onChange={event => updatePlanItem(index, { content: event.target.value })} className={control + " min-h-20 resize-y"} /></label>
                <label className="grid min-w-0 gap-1 text-sm font-semibold">Người thực hiện <span className="font-normal text-text-muted">(không bắt buộc, tối đa 200 ký tự)</span><input list={peopleId} maxLength={200} value={item.assignee} onChange={event => updatePlanItem(index, { assignee: event.target.value })} className={control} /></label>
                <label className="grid min-w-0 gap-1 text-sm font-semibold">Thời hạn <span className="font-normal text-text-muted">(không bắt buộc)</span><input type="date" value={item.dueDate} onChange={event => updatePlanItem(index, { dueDate: event.target.value })} className={control} /></label>
                <div className="flex flex-wrap items-end gap-2"><button type="button" disabled={busy || index === 0} onClick={() => movePlanItem(index, -1)} className={action} aria-label={`Đưa dòng ${index + 1} lên`}>Lên</button><button type="button" disabled={busy || index === planItems.length - 1} onClick={() => movePlanItem(index, 1)} className={action} aria-label={`Đưa dòng ${index + 1} xuống`}>Xuống</button><button type="button" disabled={busy} onClick={() => removePlanItem(index)} className={action} aria-label={`Xóa dòng ${index + 1}`}>Xóa</button></div>
              </div>
            </fieldset>)}</div>
            <datalist id={peopleId}>{people.map(person => <option key={person} value={person} />)}</datalist>
            {!planResult.ok ? <p id={planErrorId} role="alert" className="mt-3 text-sm text-red-700">{planResult.message}</p> : null}
            <button type="button" disabled={busy || planItems.length >= 100} onClick={addPlanItem} className={action + " mt-3"}>Thêm dòng</button>
          </section>
        </div> : null}
      </div>
      <footer className="shrink-0 border-t border-border bg-surface px-4 py-3 sm:px-6">
        {downloadError ? <div className="mb-3"><ErrorState message={downloadError} /></div> : null}
        {busy ? <div className="mb-3"><LoadingState label="Đang tạo tệp DOCX…" /></div> : null}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className={action}>Hủy</button><button type="button" onClick={() => void download()} aria-describedby={!planResult.ok ? planErrorId : undefined} disabled={selectedCount === 0 || stale || loading || busy || !planResult.ok} className={action + " bg-orange-700 text-white"}>Tải DOCX ({selectedCount} việc)</button></div>
      </footer>
    </section>
  </dialog>;
}
