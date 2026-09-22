"use client";

import { useEffect, useState } from "react";

type Person = { id: string; full_name: string };
type EventRow = {
  id: string;
  work_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  title: string;
  location: string | null;
  notes: string | null;
  event_type: string;
  event_status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  workflow_revision: number;
  participant_ids: string[];
};

export default function EventAssignmentPanel({ people, compact = false }: { people: Person[]; compact?: boolean }) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<EventRow | null>(null);

  const reload = () => {
    fetch("/api/work-schedule/events?from=2000-01-01&to=2100-12-31")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body) => setRows(body.rows ?? []))
      .catch(() => setRows([]));
  };

  useEffect(() => { reload(); }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      ...(editing ? { id: editing.id, workflowRevision: editing.workflow_revision } : {}),
      eventType: String(form.get("eventType") ?? ""),
      title: String(form.get("title") ?? ""),
      workDate: String(form.get("workDate") ?? ""),
      endDate: String(form.get("endDate") ?? ""),
      startTime: String(form.get("startTime") ?? ""),
      endTime: String(form.get("endTime") ?? ""),
      location: String(form.get("location") ?? ""),
      notes: String(form.get("notes") ?? ""),
      reporterIds: selected,
    };
    try {
      const response = await fetch("/api/work-schedule/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();
      setMessage("Đã lưu sự kiện và phân công phóng viên.");
      setOpen(false);
      setEditing(null);
      setSelected([]);
      reload();
    } catch {
      setMessage("Không thể lưu sự kiện. Vui lòng kiểm tra lại.");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (row: EventRow, action: "cancel" | "complete") => {
    const response = await fetch("/api/work-schedule/events", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: row.id, action, workflowRevision: row.workflow_revision }),
    });
    if (response.ok) reload();
  };

  return (
    <section className={compact ? "relative" : "mt-3 rounded-xl border border-orange-200 bg-orange-50/40 p-4 shadow-sm"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {!compact ? <><h2 className="font-bold text-orange-950">Phân công sự kiện</h2><p className="mt-1 text-xs text-slate-600">Sự kiện có hiệu lực ngay, không tạo Giao việc.</p></> : null}
        </div>
        <button type="button" onClick={() => { setEditing(null); setSelected([]); setMessage(""); setOpen(true); }} className="min-h-10 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white">Tạo sự kiện / Phân công sự kiện</button>
      </div>
      {message ? <p role="status" className="mt-2 text-sm text-slate-700">{message}</p> : null}
      {!compact ? <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <article key={row.id} className="rounded-lg border bg-white p-3 text-sm">
            <p className="font-semibold">{row.title}</p>
            <p className="text-slate-600">{row.work_date} {row.start_time.slice(0, 5)}-{row.end_time.slice(0, 5)} · {row.event_type}</p>
            <p className="text-slate-600">Phóng viên: {row.participant_ids.map((id) => people.find((person) => person.id === id)?.full_name ?? id).join(", ")}</p>
            <span className="inline-flex rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">Được phân công</span>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{row.event_status}</span>
              {row.event_status === "SCHEDULED" ? <>
                <button type="button" onClick={() => { setEditing(row); setSelected(row.participant_ids); setOpen(true); }} className="rounded border px-2 py-1 text-xs font-semibold">Sửa</button>
                <button type="button" onClick={() => void setStatus(row, "complete")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Hoàn tất</button>
                <button type="button" onClick={() => void setStatus(row, "cancel")} className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">Hủy</button>
              </> : null}
            </div>
          </article>
        ))}
      </div> : null}
      {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true">
        <form onSubmit={submit} className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
          <h3 className="text-lg font-semibold">{editing ? "Sửa sự kiện" : "Tạo sự kiện / Phân công sự kiện"}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Loại sự kiện<input name="eventType" required maxLength={100} defaultValue={editing?.event_type ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm font-medium">Tiêu đề<input name="title" required maxLength={500} defaultValue={editing?.title ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm font-medium">Từ ngày<input name="workDate" type="date" required defaultValue={editing?.work_date ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm font-medium">Đến ngày<input name="endDate" type="date" required defaultValue={editing?.end_date ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm font-medium">Giờ bắt đầu<input name="startTime" type="time" required defaultValue={editing?.start_time?.slice(0, 5) ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm font-medium">Giờ kết thúc<input name="endTime" type="time" required defaultValue={editing?.end_time?.slice(0, 5) ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
          </div>
          <label className="mt-3 block text-sm font-medium">Địa điểm<input name="location" maxLength={500} defaultValue={editing?.location ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
          <label className="mt-3 block text-sm font-medium">Nội dung<textarea name="notes" maxLength={2000} defaultValue={editing?.notes ?? ""} className="mt-1 min-h-20 w-full rounded border px-3 py-2" /></label>
          <fieldset className="mt-3 rounded border p-3"><legend className="px-1 text-sm font-semibold">Chọn phóng viên</legend><div className="grid gap-2 sm:grid-cols-2">{people.map((person) => <label key={person.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(person.id)} onChange={() => setSelected((current) => current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id])} />{person.full_name}</label>)}</div></fieldset>
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded border px-4 py-2 text-sm font-semibold">Hủy</button><button disabled={busy} className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white">{busy ? "Đang lưu..." : "Lưu sự kiện"}</button></div>
        </form>
      </div> : null}
    </section>
  );
}
