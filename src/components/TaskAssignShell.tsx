"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type { AssignmentDepartment, AssignmentPerson } from "@/lib/taskAssignmentRepository";

const controlClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900";

export default function TaskAssignShell({ departments, people, userLabel }: {
  departments: AssignmentDepartment[];
  people: AssignmentPerson[];
  userLabel: string;
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const [departmentId, setDepartmentId] = useState("");
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selectedDepartment = departments.find((department) => department.id === departmentId);
  const scopedPeople = useMemo(
    () => people.filter((person) => person.departmentId === departmentId),
    [departmentId, people],
  );
  const managerLabel = selectedDepartment?.managerId
    ? people.find((person) => person.id === selectedDepartment.managerId)?.fullName ?? "Trưởng phòng chính"
    : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDepartment?.managerId) {
      setMessage("Phòng ban đã chọn chưa có Trưởng phòng chính. Hãy cấu hình trước khi giao việc.");
      return;
    }
    setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const values = (name: string) => form.getAll(name).map(String).filter(Boolean);
    const payload = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      departmentId: String(form.get("departmentId") ?? ""),
      assigneeId: String(form.get("assigneeId") ?? ""),
      reviewerId: String(form.get("reviewerId") ?? ""),
      dueDate: String(form.get("dueDate") ?? ""),
      evaluationCriteria: String(form.get("evaluationCriteria") ?? ""),
      collaboratorIds: values("collaboratorIds"),
      watcherIds: values("watcherIds"),
      recurrenceFrequency: recurrenceFrequency || null,
      recurrenceEndsOn: recurrenceFrequency
        ? String(form.get("recurrenceEndsOn") ?? "") || null : null,
    };
    try {
      const response = await fetch("/api/tasks/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(response.status === 403
        ? "Bạn không có quyền giao công việc này."
        : "Không thể tạo công việc. Kiểm tra Trưởng phòng chính và dữ liệu biểu mẫu.");
      const result = await response.json() as { task: { id: string } };
      const attachment = form.get("attachment");
      if (attachment instanceof File && attachment.size > 0) {
        const upload = new FormData(); upload.set("file", attachment);
        const uploaded = await fetch(`/api/tasks/${result.task.id}/attachments`, {
          method: "POST", body: upload,
        });
        if (!uploaded.ok) throw new Error("Công việc đã tạo nhưng tệp đính kèm chưa tải lên được.");
      }
      router.push(`/tasks/${result.task.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Có lỗi xảy ra.");
    } finally { setBusy(false); }
  };

  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row lg:gap-6">
      <AppNav currentPath="/tasks/assign" userLabel={userLabel} onLogout={() => { logout(); router.replace("/login"); }} />
      <main className="min-w-0 flex-1">
        <header className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <Link href="/tasks" className="text-sm font-semibold text-orange-700 hover:underline">← Quay lại Quản lý công việc</Link>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">GIAO VIỆC</h1>
          <p className="mt-1 text-sm text-slate-600">Trưởng phòng chính của người thực hiện được thêm làm người theo dõi tự động.</p>
        </header>
        <form onSubmit={submit} className="mt-4 grid gap-5 rounded-xl border bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-2">
          <Field label="Tên công việc"><input name="title" required maxLength={500} className={controlClass} /></Field>
          <Field label="Phòng ban"><select name="departmentId" required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={controlClass}><option value="">Chọn phòng ban</option>{departments.map((department) => <option key={department.id} value={department.id} disabled={!department.hasManager}>{department.name}{department.hasManager ? "" : " — thiếu Trưởng phòng chính"}</option>)}</select></Field>
          {departmentId ? <div role={managerLabel ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm lg:col-span-2 ${managerLabel ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {managerLabel
              ? `Theo dõi mặc định: ${managerLabel}. Hệ thống kiểm tra lại Trưởng phòng chính hiện hành khi lưu.`
              : "Phòng ban này chưa có Trưởng phòng chính; không thể giao việc."}
          </div> : null}
          <Field label="Nội dung" wide><textarea name="description" required maxLength={10000} rows={5} className={controlClass} /></Field>
          <Field label="Người thực hiện"><select name="assigneeId" required className={controlClass}><option value="">Chọn người thực hiện</option>{scopedPeople.map(personOption)}</select></Field>
          <Field label="Người duyệt"><select name="reviewerId" required className={controlClass}><option value="">Chọn người duyệt</option>{people.filter((person) => person.canReview).map(personOption)}</select></Field>
          <Field label="Hạn hoàn thành"><input name="dueDate" type="date" required className={controlClass} /></Field>
          <Field label="Lặp lại"><select name="recurrenceFrequency" value={recurrenceFrequency} onChange={(e) => setRecurrenceFrequency(e.target.value)} className={controlClass}><option value="">Không lặp</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></Field>
          {recurrenceFrequency ? <Field label="Ngày kết thúc lặp"><input name="recurrenceEndsOn" type="date" className={controlClass} /></Field> : <input name="recurrenceEndsOn" type="hidden" value="" />}
          <Field label="Tiêu chí đánh giá / barem (chỉnh tay)" wide>
            <textarea name="evaluationCriteria" maxLength={10000} rows={6} placeholder={"Mô tả kết quả cần đạt, các mức điểm và trọng số. Ví dụ:\n- Đúng yêu cầu: 50 điểm\n- Đúng hạn: 30 điểm\n- Chất lượng trình bày: 20 điểm"} className={controlClass} />
            <span className="font-normal text-slate-500">Barem được lưu cùng công việc và có thể nhập, chỉnh sửa trực tiếp trước khi giao việc.</span>
          </Field>
          <Field label="Người phối hợp"><select name="collaboratorIds" multiple className={`${controlClass} min-h-32`}>{scopedPeople.map(personOption)}</select></Field>
          <Field label="Người theo dõi bổ sung"><select name="watcherIds" multiple aria-describedby="watcher-help" className={`${controlClass} min-h-32`}>{people.map(personOption)}</select><span id="watcher-help" className="font-normal text-slate-500">Giữ Ctrl/Cmd để chọn nhiều người. Trưởng phòng chính được thêm tự động và các lựa chọn trùng sẽ được gộp.</span></Field>
          <Field label="Đính kèm riêng tư"><input name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" className={controlClass} /></Field>
          <div className="flex items-end"><button disabled={busy || !departmentId || !selectedDepartment?.managerId} className="w-full rounded-lg bg-orange-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Đang tạo…" : "Giao việc"}</button></div>
          {message ? <p role="alert" className="text-sm text-red-700 lg:col-span-2">{message}</p> : null}
        </form>
      </main>
    </div>
  </div>;
}

const personOption = (person: AssignmentPerson) => <option key={person.id} value={person.id}>{person.fullName}</option>;
function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`grid gap-1 text-sm font-semibold ${wide ? "lg:col-span-2" : ""}`}><span>{label}</span>{children}</label>;
}
