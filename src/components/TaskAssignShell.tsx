"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type { AssignmentDepartment, AssignmentPerson } from "@/lib/taskAssignmentRepository";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

const controlClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900";

export default function TaskAssignShell({ departments, people, userLabel }: {
  departments: AssignmentDepartment[];
  people: AssignmentPerson[];
  userLabel: string;
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const { notify } = useActionFeedback();
  const [departmentId, setDepartmentId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<"individual" | "department_group">("individual");
  const [excludedMemberIds, setExcludedMemberIds] = useState<string[]>([]);
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [watcherIds, setWatcherIds] = useState<string[]>([]);
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
      const text = "Phòng ban đã chọn chưa có Trưởng phòng chính. Hãy cấu hình trước khi giao việc."; setMessage(text); notify("error", text);
      return;
    }
    setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      departmentId: String(form.get("departmentId") ?? ""),
      assigneeId: String(form.get("assigneeId") ?? ""),
      reviewerId: String(form.get("reviewerId") ?? ""),
      dueDate: String(form.get("dueDate") ?? ""),
      evaluationCriteria: String(form.get("evaluationCriteria") ?? ""),
      priority: String(form.get("priority") ?? "normal"),
      dueTime: String(form.get("dueTime") ?? ""),
      collaboratorIds,
      watcherIds,
      groupDepartmentId: assignmentMode === "department_group" ? departmentId : null,
      excludedMemberIds: assignmentMode === "department_group" ? excludedMemberIds : [],
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
      if (!response.ok) throw new Error(await responseErrorMessage(response, response.status === 403 ? "Bạn không có quyền giao công việc này." : "Không thể tạo công việc."));
      const result = await response.json() as { task: { id: string } };
      const attachment = form.get("attachment");
      let attachmentWarning = "";
      if (attachment instanceof File && attachment.size > 0) {
        const upload = new FormData(); upload.set("file", attachment);
        const uploaded = await fetch(`/api/tasks/${result.task.id}/attachments`, {
          method: "POST", body: upload,
        });
        if (!uploaded.ok) attachmentWarning = await responseErrorMessage(uploaded, "Tệp đính kèm chưa tải lên được.");
      }
      notify(attachmentWarning ? "error" : "success", attachmentWarning || "Đã giao công việc thành công.");
      if (attachmentWarning) setMessage(`Đã tạo công việc, nhưng ${attachmentWarning.toLowerCase()} Bạn có thể tải tệp tại trang chi tiết.`);
      router.push(`/tasks/${result.task.id}`);
      router.refresh();
    } catch (error) {
      const text = errorMessage(error, "Có lỗi xảy ra."); setMessage(text); notify("error", text);
    } finally { setBusy(false); }
  };

  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 lg:flex-row lg:gap-4">
      <AppNav currentPath="/tasks/assign" userLabel={userLabel} onLogout={() => { logout(); router.replace("/login"); }} />
      <main className="min-w-0 flex-1">
        <header className="rounded-2xl border bg-white p-4 shadow-sm">
          <h1 className="text-2xl font-bold sm:text-3xl">GIAO VIỆC</h1>
        </header>
        <form onSubmit={submit} className="mt-3 grid items-start gap-x-4 gap-y-3 rounded-xl border bg-white p-4 shadow-sm lg:grid-cols-2">
          <div className="grid gap-3 lg:col-span-2 lg:grid-cols-3">
            <Field label="Tên công việc"><input name="title" required maxLength={500} className={controlClass} /></Field>
            <Field label="Phòng ban / nhóm"><select name="departmentId" required value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setAssigneeId(""); setExcludedMemberIds([]); setCollaboratorIds([]); setWatcherIds([]); }} className={controlClass}><option value="">Chọn phòng ban</option>{departments.map((department) => <option key={department.id} value={department.id} disabled={!department.hasManager}>{department.name}{department.hasManager ? "" : " — thiếu Trưởng phòng chính"}</option>)}</select></Field>
            <Field label="Cách chọn người"><select value={assignmentMode} onChange={(e) => { setAssignmentMode(e.target.value as "individual" | "department_group"); setExcludedMemberIds([]); setCollaboratorIds([]); }} className={controlClass}><option value="individual">Cá nhân</option><option value="department_group">Nhóm phòng ban</option></select></Field>
          </div>
          {departmentId ? <div role={managerLabel ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm lg:col-span-2 ${managerLabel ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {managerLabel
              ? `Theo dõi mặc định: ${managerLabel}. Hệ thống kiểm tra lại Trưởng phòng chính hiện hành khi lưu.`
              : "Phòng ban này chưa có Trưởng phòng chính; không thể giao việc."}
          </div> : null}
          <Field label="Nội dung" wide><textarea name="description" required maxLength={10000} rows={3} className={controlClass} /></Field>
          <Field label="Người chịu trách nhiệm chính"><select name="assigneeId" required value={assigneeId} className={controlClass} onChange={(event) => { setAssigneeId(event.target.value); setExcludedMemberIds((current) => current.filter((id) => id !== event.target.value)); setCollaboratorIds((current) => current.filter((id) => id !== event.target.value)); setWatcherIds((current) => current.filter((id) => id !== event.target.value)); }}><option value="">Chọn người thực hiện</option>{scopedPeople.map(personOption)}</select></Field>
          <Field label="Người duyệt (Tổng Biên Tập, Phó Tổng Biên Tập, Trưởng/Phó phòng)"><select name="reviewerId" required className={controlClass}><option value="">Chọn người duyệt</option>{people.filter((person) => person.canReview && (person.canReviewOutsideDepartment || person.departmentId === departmentId)).map(personOption)}</select></Field>
          <div className="grid gap-3 lg:col-span-2 lg:grid-cols-3">
            <Field label="Độ khó"><select name="priority" defaultValue="normal" className={controlClass}><option value="low">Dễ</option><option value="normal">Trung bình</option><option value="high">Khó</option><option value="urgent">Rất khó</option></select></Field>
            <Field label="Hạn hoàn thành"><div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2"><input name="dueDate" aria-label="Ngày hoàn thành" type="date" required className={controlClass} /><input name="dueTime" aria-label="Giờ hoàn thành" type="time" required defaultValue="17:00" step="60" className={controlClass} /></div></Field>
            <Field label="Lặp lại"><select name="recurrenceFrequency" value={recurrenceFrequency} onChange={(e) => setRecurrenceFrequency(e.target.value)} className={controlClass}><option value="">Không lặp</option><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></Field>
          </div>
          {recurrenceFrequency ? <Field label="Ngày kết thúc lặp"><input name="recurrenceEndsOn" type="date" className={controlClass} /></Field> : <input name="recurrenceEndsOn" type="hidden" value="" />}
          <Field label="Tiêu chí đánh giá / barem (chỉnh tay)" wide>
            <textarea name="evaluationCriteria" maxLength={10000} rows={4} placeholder={"Mô tả kết quả cần đạt, các mức điểm và trọng số. Ví dụ:\n- Đúng yêu cầu: 50 điểm\n- Đúng hạn: 30 điểm\n- Chất lượng trình bày: 20 điểm"} className={controlClass} />
            <span className="font-normal text-slate-500">Barem được lưu cùng công việc và có thể nhập, chỉnh sửa trực tiếp trước khi giao việc.</span>
          </Field>
          {assignmentMode === "individual" ? <Field label="Người phối hợp"><CheckGroup name="collaboratorIds" people={scopedPeople.filter((person) => person.id !== assigneeId)} selected={collaboratorIds} onChange={setCollaboratorIds} empty="Không còn người phù hợp trong phòng." /></Field> : <Field label="Danh sách thành viên active" wide><input type="hidden" name="groupDepartmentId" value={departmentId} />{excludedMemberIds.map((id) => <input key={id} type="hidden" name="excludedMemberIds" value={id} />)}<div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">{scopedPeople.map((person) => { const primary = person.id === assigneeId; const manager = person.id === selectedDepartment?.managerId; const fixed = primary || manager; return <label key={person.id} className="flex items-center gap-2 rounded bg-slate-50 px-3 py-2 text-sm"><input type="checkbox" disabled={fixed} checked={fixed || !excludedMemberIds.includes(person.id)} onChange={(event) => setExcludedMemberIds((current) => event.target.checked ? current.filter((id) => id !== person.id) : [...new Set([...current, person.id])])} /><span>{person.fullName}{primary ? " — Người chịu trách nhiệm chính" : manager ? " — Trưởng phòng, theo dõi tự động" : ""}</span></label>; })}{scopedPeople.length === 0 ? <p className="text-sm text-slate-500">Chưa có thành viên active.</p> : null}</div><span className="font-normal text-slate-500">Bỏ chọn để loại thành viên; server sẽ tải lại membership hiện hành khi lưu. Người chịu trách nhiệm chính và Trưởng phòng không thể bị loại.</span></Field>}
          <Field label="Người theo dõi bổ sung"><CheckGroup name="watcherIds" people={people.filter((person) => person.id !== assigneeId && !collaboratorIds.includes(person.id))} selected={watcherIds} onChange={setWatcherIds} empty="Không còn người phù hợp." /><span className="font-normal text-slate-500">Trưởng phòng chính được thêm tự động; lựa chọn trùng sẽ được gộp.</span></Field>
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
  return <label className={`grid self-start gap-1 text-sm font-semibold ${wide ? "lg:col-span-2" : ""}`}><span>{label}</span>{children}</label>;
}

function CheckGroup({ name, people, selected, onChange, empty }: {
  name: string; people: AssignmentPerson[]; selected: string[];
  onChange: (ids: string[]) => void; empty: string;
}) {
  return <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/40 p-1.5">{people.map((person) => <label key={person.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-normal hover:bg-orange-50"><input name={name} type="checkbox" value={person.id} checked={selected.includes(person.id)} onChange={(event) => onChange(event.target.checked ? [...new Set([...selected, person.id])] : selected.filter((id) => id !== person.id))} /><span>{person.fullName}</span></label>)}{people.length === 0 ? <p className="px-2 py-3 font-normal text-slate-500">{empty}</p> : null}</div>;
}
