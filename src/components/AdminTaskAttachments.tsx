"use client";
import { useState, type FormEvent } from "react";
import type { TaskDetailDto } from "@/lib/taskContracts";
import { responseErrorMessage, errorMessage } from "@/lib/actionFeedback";

export default function AdminTaskAttachments({ task }: { task: TaskDetailDto }) {
  const [attachments, setAttachments] = useState(task.attachments);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/tasks/${task.id}/attachments`, { method: "POST", body: new FormData(form) });
      if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể tải tệp lên."));
      const body = await response.json(); setAttachments(items => [...items, body.attachment]); form.reset();
      setMessage("Đã tải tệp lên.");
    } catch (error) { setMessage(errorMessage(error, "Không thể tải tệp lên.")); }
    finally { setBusy(false); }
  }
  function open(id: string) {
    window.open(`/api/tasks/${task.id}/attachments/${id}`, "_blank", "noopener,noreferrer");
  }
  async function remove(id: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/tasks/${task.id}/attachments/${id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
      if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể xóa tệp. Có thể thử lại."));
      setAttachments(items => items.filter(item => item.id !== id)); setMessage("Đã xóa tệp và ghi lịch sử quản trị.");
    } catch (error) { setMessage(errorMessage(error, "Không thể xóa tệp. Có thể thử lại.")); }
    finally { setBusy(false); }
  }
  return <section className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm">
    <h2 className="font-semibold">Tệp đính kèm</h2>
    {attachments.length ? <ul className="grid gap-2">{attachments.map(item => <li key={item.id} className="flex items-center gap-3"><button type="button" disabled={busy} onClick={() => open(item.id)} className="min-w-0 flex-1 break-words text-left text-orange-700 underline">{item.file_name}</button><button type="button" disabled={busy || !reason.trim()} onClick={() => remove(item.id)} className="rounded border border-red-200 px-3 py-2 text-red-700 disabled:opacity-50">Xóa</button></li>)}</ul> : <p className="text-sm text-slate-500">Chưa có tệp đính kèm.</p>}
    <label className="text-sm font-semibold">Lý do xóa tệp<input value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} placeholder="Bắt buộc khi xóa tệp" className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
    <form onSubmit={upload} className="flex flex-wrap gap-2"><input aria-label="Chọn tệp đính kèm" type="file" name="file" required disabled={busy || task.status === "cancelled"} accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" className="min-w-0 flex-1"/><button disabled={busy || task.status === "cancelled"} className="rounded-lg border px-3 py-2 disabled:opacity-50">Tải tệp lên</button></form>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </section>;
}
