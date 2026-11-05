"use client";

import { useEffect, useImperativeHandle, useMemo, useState, type Ref } from "react";
import Time24hInput from "@/components/Time24hInput";
import { sortStaffRows } from "@/lib/staffOrdering";
import { canEditEventAssignment, outOfListEventMembers } from "@/lib/workScheduleEventAccess";

type Person = { id: string; full_name: string; username?: string | null; department_id?: string | null; active?: boolean; roles?: { code?: string } | null; job_titles?: { code?: string; name?: string } | null; departments?: { name?: string; code?: string } | null };
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
  created_by: string;
};

export type EventAssignmentPanelHandle = { editEvent: (id: string) => Promise<void> };

export default function EventAssignmentPanel({ people, open, onOpenChange, onChanged, ref, currentUserId, currentUserRole, isDepartmentManager }: { people: Person[]; open: boolean; onOpenChange: (open: boolean) => void; onChanged: () => void; ref?: Ref<EventAssignmentPanelHandle>; currentUserId?: string; currentUserRole?: string; isDepartmentManager?: boolean }) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const setOpen = onOpenChange;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<EventRow | null>(null);

  const reload = () => {
    return fetch("/api/work-schedule/events?from=2000-01-01&to=2100-12-31")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body) => { const loadedRows: EventRow[] = body.rows ?? []; setRows(loadedRows); return loadedRows; })
      .catch(() => { setMessage("Không tải được danh sách sự kiện. Vui lòng thử lại."); return null; });
  };

  useEffect(() => { reload(); }, []);


  const [search, setSearch] = useState("");
  const actor = { id: currentUserId, role_code: currentUserRole, is_department_manager: isDepartmentManager };
  const outsideMembers = outOfListEventMembers(selected, people);
  const startEditing = (row: EventRow) => {
    setEditing(row); setSelected([...row.participant_ids]); setMessage(""); setSearch(""); setSaved(false); setOpen(true);
  };
  useImperativeHandle(ref, () => ({
    async editEvent(id) {
      const loadedRows = await reload();
      if (!loadedRows) return;
      const row = loadedRows.find((row) => row.id === id);
      if (!row) { setMessage("Không tìm thấy sự kiện trong danh sách phân công."); return; }
      if (!canEditEventAssignment(row, actor)) { setMessage("Sự kiện không còn có thể chỉnh sửa."); return; }
      startEditing(row);
    },
  }));
  const filteredPeople = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return sortStaffRows(people).filter((person) => {
      const label = `${person.full_name} ${person.job_titles?.name ?? person.job_titles?.code ?? ""}`.toLocaleLowerCase("vi");
      return !query || label.includes(query);
    });
  }, [people, search]);
  const groupedPeople = useMemo(() => {
    const groups = new Map<string, Person[]>();
    for (const person of filteredPeople) {
      const name = person.departments?.name ?? "Chưa xác định phòng ban";
      groups.set(name, [...(groups.get(name) ?? []), person]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "vi"));
  }, [filteredPeople]);

  const close = () => {
    setOpen(false);
    setEditing(null);
    setSelected([]);
    setSearch("");
    setMessage("");
    setSaved(false);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selected.length < 1 || selected.length > 50) {
      setMessage("Vui lòng chọn từ 1 đến 50 thành viên.");
      return;
    }
    setBusy(true);
    setMessage("");
    setSaved(false);
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
      if (response.status === 409) {
        setMessage("Sự kiện đã được người khác cập nhật, vui lòng tải lại.");
        void reload();
        return;
      }
      if (!response.ok) throw new Error();
      setMessage("Đã lưu sự kiện và phân công nhân sự.");
      setSaved(true);
      setTimeout(() => {
        setOpen(false);
        setEditing(null);
        setSelected([]);
        setSearch("");
        setMessage("");
        setSaved(false);
      }, 500);
      reload();
      onChanged();
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
    if (response.ok) { reload(); onChanged(); }
  };

  return (
    <section className="mt-3 rounded-xl border border-orange-200 bg-orange-50/40 p-4 shadow-sm">
      {!open && message ? <p role="status" className="mt-2 text-sm text-slate-700">{message}</p> : null}
      <details>
        <summary className="cursor-pointer font-semibold text-orange-950">Sự kiện đã phân công ({rows.length})</summary>
      <div className="mt-3 grid gap-2">
      {rows.map((row) => (
          <article key={row.id} className="rounded-lg border bg-white p-3 text-sm">
            <p className="font-semibold">{row.title}</p>
            <p className="text-slate-600">{row.work_date} {row.start_time.slice(0, 5)}-{row.end_time.slice(0, 5)} · {row.event_type}</p>
            <p className="text-slate-600">Nhân sự: {row.participant_ids.map((id) => people.find((person) => person.id === id)?.full_name ?? id).join(", ")}</p>
            <span className="inline-flex rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">Được phân công</span>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{row.event_status === "COMPLETED" ? "Hoàn thành" : row.event_status === "CANCELLED" ? "Đã hủy" : "Đã lên lịch"}</span>
              {canEditEventAssignment(row, actor) ? <button type="button" onClick={() => startEditing(row)} className="rounded border px-2 py-1 text-xs font-semibold">Sửa sự kiện / thành viên</button> : null}
              {row.event_status === "SCHEDULED" ? <>
                <button type="button" onClick={() => void setStatus(row, "complete")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Hoàn tất</button>
                <button type="button" onClick={() => void setStatus(row, "cancel")} className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">Hủy</button>
              </> : null}
              {row.event_status === "CANCELLED" ? <span className="text-xs text-slate-500">Sự kiện đã hủy — không thể sửa.</span> : null}
            </div>
          </article>
        ))}
      </div>
      </details>
      {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true">
        <form key={editing?.id ?? "new"} onSubmit={submit} className="max-h-[calc(100dvh-2rem)] overflow-y-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
          {message ? <p role="status" className="text-sm text-slate-700">{message}</p> : null}
          <h3 className="text-lg font-semibold">{editing ? "Sửa sự kiện" : "Phân công sự kiện"}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Loại sự kiện<input name="eventType" required maxLength={100} defaultValue={editing?.event_type ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm font-medium">Tiêu đề<input name="title" required maxLength={500} defaultValue={editing?.title ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm font-medium">Từ ngày<input name="workDate" type="date" required defaultValue={editing?.work_date ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm font-medium">Đến ngày<input name="endDate" type="date" required defaultValue={editing?.end_date ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm font-medium">Giờ bắt đầu<Time24hInput name="startTime" required defaultValue={editing?.start_time?.slice(0, 5) ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm font-medium">Giờ kết thúc<Time24hInput name="endTime" required defaultValue={editing?.end_time?.slice(0, 5) ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
          </div>
          <label className="mt-3 block text-sm font-medium">Địa điểm<input name="location" maxLength={500} defaultValue={editing?.location ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
          <label className="mt-3 block text-sm font-medium">Nội dung<textarea name="notes" maxLength={2000} defaultValue={editing?.notes ?? ""} className="mt-1 min-h-20 w-full rounded border px-3 py-2" /></label>
          <fieldset className="mt-3 rounded border p-3"><legend className="px-1 text-sm font-semibold">Chọn nhân sự · đã chọn {selected.length}</legend>{outsideMembers.length ? <div className="mb-3 flex flex-wrap gap-2">{outsideMembers.map((id) => <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-amber-100 pl-3 text-sm text-amber-950"><span className="break-all">{id} · ngoài danh sách</span><button type="button" aria-label={`Xóa thành viên ${id} ngoài danh sách`} disabled={busy || saved} onClick={() => setSelected((current) => current.filter((memberId) => memberId !== id))} className="min-h-11 min-w-11 shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-orange-500">×</button></span>)}</div> : null}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc chức danh" aria-label="Tìm nhân sự" className="mb-3 min-h-10 w-full rounded border px-3 py-2 text-sm" /><div className="grid gap-3">{groupedPeople.map(([department, members]) => <div key={department}><h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-600">{department}</h4><div className="grid gap-2 sm:grid-cols-2">{members.map((person) => <label key={person.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(person.id)} onChange={() => setSelected((current) => current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id])} /><span>{person.full_name}<span className="ml-1 text-xs text-slate-500">({person.job_titles?.name ?? person.job_titles?.code ?? "Nhân sự"})</span></span></label>)}</div></div>)}</div></fieldset>
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={close} disabled={busy || saved} className="rounded border px-4 py-2 text-sm font-semibold">Hủy</button><button disabled={busy || saved} className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white">{busy ? "Đang lưu..." : saved ? "Đã lưu" : "Lưu sự kiện"}</button></div>
        </form>
      </div> : null}
    </section>
  );
}
