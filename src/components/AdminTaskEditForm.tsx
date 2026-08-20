"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { TaskDetailDto } from "@/lib/taskContracts";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

export default function AdminTaskEditForm({ task }: { task: TaskDetailDto }) {
  const router = useRouter(); const { notify } = useActionFeedback();
  const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(["title","description","startDate","dueDate","dueTime","priority","status","evaluationCriteria","reason"].map((key) => [key,String(form.get(key) ?? "")]));
    try {
      const response = await fetch(`/api/tasks/${task.id}/admin-edit`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify(body) });
      if (!response.ok) throw new Error(await responseErrorMessage(response,"Không thể cập nhật công việc."));
      notify("success","Đã cập nhật công việc và ghi lịch sử quản trị."); router.push(`/tasks/${task.id}`); router.refresh();
    } catch (cause) { const text=errorMessage(cause,"Không thể cập nhật công việc."); setError(text); notify("error",text); }
    finally { setBusy(false); }
  };
  const control="mt-1 w-full rounded-lg border px-3 py-2";
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-2">
    <label className="text-sm font-semibold sm:col-span-2">Tiêu đề<input name="title" required maxLength={500} defaultValue={task.title} className={control}/></label>
    <label className="text-sm font-semibold sm:col-span-2">Nội dung<textarea name="description" required maxLength={10000} defaultValue={task.description ?? ""} rows={6} className={control}/></label>
    <label className="text-sm font-semibold">Ngày bắt đầu<input name="startDate" type="date" required defaultValue={task.start_date ?? ""} className={control}/></label>
    <label className="text-sm font-semibold">Deadline<div className="grid grid-cols-[1fr_110px] gap-2"><input name="dueDate" type="date" required defaultValue={task.due_date ?? ""} className={control}/><input name="dueTime" type="time" defaultValue={task.due_time?.slice(0,5) ?? ""} className={control}/></div></label>
    <label className="text-sm font-semibold">Mức độ<select name="priority" defaultValue={task.priority} className={control}><option value="low">Dễ</option><option value="normal">Vừa</option><option value="high">Khó</option><option value="urgent">Rất khó</option></select></label>
    <label className="text-sm font-semibold">Trạng thái<select name="status" defaultValue={task.status} className={control}><option value="new">Mới</option><option value="in_progress">Đang làm</option><option value="blocked">Có vướng mắc</option><option value="waiting">Chờ phối hợp</option><option value="pending_review">Chờ duyệt</option><option value="done">Hoàn thành</option><option value="rejected">Trả lại</option><option value="cancelled">Đã hủy</option></select></label>
    <label className="text-sm font-semibold sm:col-span-2">Tiêu chí đánh giá<textarea name="evaluationCriteria" maxLength={10000} defaultValue={task.evaluation_criteria ?? ""} rows={4} className={control}/></label>
    <label className="text-sm font-semibold sm:col-span-2">Lý do chỉnh sửa<input name="reason" required maxLength={2000} placeholder="Bắt buộc để lưu lịch sử thay đổi" className={control}/></label>
    {error ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>:null}
    <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?"Đang lưu…":"Lưu thay đổi"}</button><button type="button" onClick={()=>router.back()} className="rounded-lg border px-4 py-2 font-semibold">Hủy</button></div>
  </form>;
}
