"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { currentReportWeek, reportDate, reportSummary, selectTaskListReportModel, taskListReportHref } from "@/lib/taskListReport.mjs";
import type { TaskListReportModel } from "@/lib/taskListReport.mjs";
import type { TaskListQuery } from "@/lib/taskContracts";

type Range = { from: string; to: string };
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
    <p className="mt-1 text-center text-sm">Từ ngày {reportDate(model.from)} đến ngày {reportDate(model.to)}</p>
    <p className="mt-4 break-words text-sm">Bộ lọc: {model.filterLabel}</p>
    <p className="mt-2 text-sm font-bold">{reportSummary(model.counts)}</p>
    {model.sections.map(section => {
      let index = 0;
      return <section key={section.key} className="mt-5 min-w-0">
        <h4 className="mb-2 font-bold">{section.title}</h4>
        <div tabIndex={0} role="region" aria-label={`Bảng ${section.title}`} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-orange-700">
          <table className="w-full min-w-[600px] table-fixed border-collapse text-left text-xs sm:text-sm">
            <colgroup>{[5, 27, 16, 16, 12, 24].map((width, i) => <col key={i} style={{ width: width + "%" }} />)}</colgroup>
            <thead><tr>{["STT", "Công việc", "Người thực hiện", "Người giao", "Hạn", "Trạng thái/Ghi chú"].map(title => <th key={title} scope="col" className="border border-slate-400 p-1.5">{title}</th>)}</tr></thead>
            <tbody>{section.groups.map(group => <Fragment key={group.name}>
              <tr><th colSpan={6} scope="rowgroup" className="border border-slate-400 bg-slate-50 p-1.5">Người thực hiện: {group.name}</th></tr>
              {group.rows.map(row => <tr key={row.id}>{[++index, row.title, row.assignees, row.assigner, row.due, row.statusNote].map((value, column) => <td key={column} className="break-words whitespace-pre-line border border-slate-400 p-1.5 align-top">{value}</td>)}</tr>)}
            </Fragment>)}{!section.groups.length ? <tr><td colSpan={6} className="border border-slate-400 p-2">Không có công việc.</td></tr> : null}</tbody>
          </table>
        </div>
      </section>;
    })}
    <p className="mt-8 text-center font-bold">NGƯỜI LẬP</p>
    <p className="mt-8 text-center">{model.userName}</p>
  </article>;
}

export default function TaskListReportDialog({ query, onClose }: { query: TaskListQuery; onClose: () => void }) {
  const [filters] = useState(query);
  const [dates, setDates] = useState<Range>(() => currentReportWeek());
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
  const preview = useMemo(() => model ? selectTaskListReportModel(model, selectedIds) : null, [model, selectedIds]);
  const selectedCount = preview?.counts.total ?? 0;
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
      setSelectedIds(report.sections.flatMap(section => section.groups.flatMap(group => group.rows.map(row => row.id))));
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
    if (!model || selectedCount === 0 || stale || loading || busy) return;
    setBusy(true); setDownloadError("");
    try {
      const response = await fetch("/api/tasks/report/docx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filters, from: model.from, to: model.to, ids: selectedIds }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Không thể xuất báo cáo công việc. Vui lòng thử lại.");
      }
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href; link.download = `Bao_cao_cong_viec_${model.from}_${model.to}.docx`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (cause) { setDownloadError(cause instanceof Error ? cause.message : "Không thể xuất báo cáo công việc."); }
    finally { setBusy(false); }
  };
  const allIds = model?.sections.flatMap(section => section.groups.flatMap(group => group.rows.map(row => row.id))) ?? [];
  const needle = normalize(search.trim());
  const matches = (row: { title: string; assignees: string }) => normalize(row.title + " " + row.assignees).includes(needle);
  const hasMatches = model?.sections.some(section => section.groups.some(group => group.rows.some(matches)));

  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }} className="mobile-dialog-overlay inset-0 z-[120] place-items-center bg-slate-950/55 p-4 open:grid" style={{ position: "fixed", margin: 0, width: "100%", maxWidth: "none", height: "100dvh", maxHeight: "none", border: 0 }}>
    <section className="flex max-h-[92dvh] w-full min-w-0 max-w-7xl flex-col overflow-hidden rounded-[var(--radius-sheet)] border border-border bg-surface text-text shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div><h2 id={titleId} className="text-lg font-bold text-brand-ink">Xuất báo cáo công việc</h2><p className="mt-1 text-sm text-text-muted">Chọn công việc và xem nội dung trước khi tải. Tối đa 1.000 công việc theo bộ lọc hiện tại.</p></div>
        <button type="button" disabled={busy} onClick={onClose} className={action} aria-label="Đóng xuất báo cáo">Đóng</button>
      </header>
      <div className="min-h-0 min-w-0 overflow-y-auto">
        <form onSubmit={event => { event.preventDefault(); if (!invalidDates) void load(dates); }} className="grid grid-cols-1 items-end gap-3 border-b border-border p-4 sm:grid-cols-[1fr_1fr_auto] sm:px-6">
          <label className="grid min-w-0 gap-1 text-sm font-semibold">Từ ngày<input type="date" required value={dates.from} max={dates.to} disabled={busy} onChange={event => setDates({ ...dates, from: event.target.value })} className={control + " w-full"} /></label>
          <label className="grid min-w-0 gap-1 text-sm font-semibold">Đến ngày<input type="date" required value={dates.to} min={dates.from} disabled={busy} onChange={event => setDates({ ...dates, to: event.target.value })} className={control + " w-full"} /></label>
          <button type="submit" disabled={invalidDates || loading || busy} className={action + " bg-orange-50 text-orange-800"}>Xem trước</button>
          {model && stale ? <p role="status" className="text-sm text-amber-800 sm:col-span-3">Khoảng ngày đã đổi. Nhấn “Xem trước” để cập nhật trước khi tải.</p> : null}
        </form>
        {loading ? <div className="p-6"><LoadingState label="Đang tải bản xem trước…" /></div> : error ? <div className="p-4"><ErrorState message={error} onRetry={() => void load(dates)} /></div> : model && preview ? <div className="grid min-w-0 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]">
          <aside aria-label="Chọn công việc để xuất" className="min-w-0 border-b border-border p-4 lg:border-r lg:border-b-0">
            <p role="status" aria-live="polite" className="font-bold text-brand-ink">Đã chọn {selectedCount}/{model.counts.total}</p>
            <div className="my-3 flex flex-wrap gap-2"><button type="button" disabled={busy || !allIds.length} onClick={() => select(allIds, true)} className={action}>Chọn tất cả</button><button type="button" disabled={busy || !selectedCount} onClick={() => select(allIds, false)} className={action}>Bỏ chọn</button></div>
            <label htmlFor={searchId} className="text-sm font-semibold">Tìm công việc hoặc người thực hiện</label>
            <input id={searchId} type="search" value={search} onChange={event => setSearch(event.target.value)} className={control + " mt-1 w-full"} placeholder="Nhập từ khóa…" />
            <div className="mt-4 max-h-[45dvh] space-y-4 overflow-y-auto lg:max-h-[60dvh]">
              {!model.counts.total ? <EmptyState title="Không có công việc trong khoảng ngày này" description="Thử chọn khoảng ngày khác hoặc thay đổi bộ lọc công việc." /> : !hasMatches ? <EmptyState title="Không tìm thấy công việc" description="Thử từ khóa khác. Các lựa chọn hiện tại vẫn được giữ." /> : model.sections.map(section => {
                const rows = section.groups.flatMap(group => group.rows);
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
          <div className="min-w-0 bg-slate-100 p-3 sm:p-5"><h3 className="mb-3 text-sm font-semibold text-text-muted">Xem trước · {selectedCount} công việc</h3><ReportPreview model={preview} /></div>
        </div> : null}
      </div>
      <footer className="shrink-0 border-t border-border bg-surface px-4 py-3 sm:px-6">
        {downloadError ? <div className="mb-3"><ErrorState message={downloadError} /></div> : null}
        {busy ? <div className="mb-3"><LoadingState label="Đang tạo tệp DOCX…" /></div> : null}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className={action}>Hủy</button><button type="button" onClick={() => void download()} disabled={selectedCount === 0 || stale || loading || busy} className={action + " bg-orange-700 text-white"}>Tải DOCX ({selectedCount} việc)</button></div>
      </footer>
    </section>
  </dialog>;
}
