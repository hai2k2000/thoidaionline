"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import EventAssignmentPanel from "@/components/EventAssignmentPanel";
import { useAuth } from "@/lib/auth";
import type { AssignmentDepartment, AssignmentPerson } from "@/lib/taskAssignmentRepository";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import { buildJournalismCreatePayload, journalismCreateErrorMessage, serializeVietnamPlannedPublication, validateJournalismCreateFields } from "@/lib/journalismCreateUi.mjs";

const controlClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900";

export default function TaskAssignShell({ departments, people, userLabel, eventPeople, journalismMode, journalismWorkKinds, journalismWorkKindsLoaded }: {
  departments: AssignmentDepartment[];
  people: AssignmentPerson[];
  userLabel: string;
  eventPeople: { id: string; full_name: string }[];
  journalismMode: boolean;
  journalismWorkKinds: { id: string; name: string; is_active: boolean }[];
  journalismWorkKindsLoaded: boolean;
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const { notify } = useActionFeedback();
  const editorialDepartment = departments.find((department) => department.code === "editorial");
  const [departmentId, setDepartmentId] = useState(journalismMode ? editorialDepartment?.id ?? "" : "");
  const [assigneeId, setAssigneeId] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<"individual" | "department_group">("individual");
  const [excludedMemberIds, setExcludedMemberIds] = useState<string[]>([]);
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [watcherIds, setWatcherIds] = useState<string[]>([]);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("");
  const [requirements, setRequirements] = useState([""]);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);
  const [message, setMessage] = useState("");
  const [journalismErrors, setJournalismErrors] = useState<Record<string, string>>({});
  const selectedDepartment = departments.find((department) => department.id === departmentId);
  useEffect(() => {
    setDepartmentId(journalismMode ? editorialDepartment?.id ?? "" : "");
    setAssigneeId("");
    setExcludedMemberIds([]);
    setCollaboratorIds([]);
    setWatcherIds([]);
  }, [editorialDepartment?.id, journalismMode]);
  const scopedPeople = useMemo(
    () => people.filter((person) => person.departmentId === departmentId),
    [departmentId, people],
  );
  const isEditorialBoard = selectedDepartment?.code === "leadership";
  const managerLabel = selectedDepartment?.managerId
    ? people.find((person) => person.id === selectedDepartment.managerId)?.fullName ?? "Trưởng phòng chính"
    : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!selectedDepartment?.managerId) {
      const text = "Phòng ban đã chọn chưa có Trưởng phòng chính. Hãy cấu hình trước khi giao việc."; setMessage(text); notify("error", text);
      return;
    }
    submittingRef.current = true; setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const plannedPublicationAt = journalismMode
      ? serializeVietnamPlannedPublication(String(form.get("plannedPublicationDate") ?? ""), String(form.get("plannedPublicationTime") ?? ""))
      : null;
    if (journalismMode) {
      const validation = validateJournalismCreateFields({ workKindId: String(form.get("workKindId") ?? ""), plannedPublicationAt, location: String(form.get("location") ?? ""), editorialNotes: String(form.get("editorialNotes") ?? "") });
      if (Object.keys(validation).length) {
        const text = "Dữ liệu gửi lên chưa hợp lệ. Kiểm tra lại các trường được đánh dấu.";
        setJournalismErrors({...validation});
        setMessage(text); notify("error", text); submittingRef.current = false; setBusy(false); return;
      }
      setJournalismErrors({});
    }
    const parentPayload = {
      title: String(form.get("title") ?? ""),
      description: requirements.filter((item) => item.trim()).map((item) => `- ${item.trim()}`).join("\n"),
      departmentId: String(form.get("departmentId") ?? ""),
      assigneeId: String(form.get("assigneeId") ?? ""),
      dueDate: String(form.get("dueDate") ?? ""),
      evaluationCriteria: null,
      priority: "normal",
      dueTime: String(form.get("dueTime") ?? ""),
      collaboratorIds,
      watcherIds,
      ...(!journalismMode ? { requirements: requirements.filter((item) => item.trim()), reviewerId: String(form.get("assigneeId") ?? ""), groupDepartmentId: assignmentMode === "department_group" ? departmentId : null, excludedMemberIds: assignmentMode === "department_group" ? excludedMemberIds : [] } : {}),
      ...(journalismMode ? {} : { recurrenceFrequency: recurrenceFrequency || null, recurrenceEndsOn: recurrenceFrequency ? String(form.get("recurrenceEndsOn") ?? "") || null : null }),
    };
    const payload = journalismMode
      ? buildJournalismCreatePayload(parentPayload, { workKindId: String(form.get("workKindId") ?? ""), plannedPublicationAt, location: String(form.get("location") ?? "").trim() || null, editorialNotes: String(form.get("editorialNotes") ?? "").trim() || null })
      : parentPayload;
    try {
      const response = await fetch(journalismMode ? "/api/tasks/journalism/assign" : "/api/tasks/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        if (journalismMode) {
          const data = await response.json().catch(() => null) as { error?: { code?: string } | string } | null;
          const code = typeof data?.error === "string" ? data.error : data?.error?.code;
          throw new Error(journalismCreateErrorMessage(code));
        }
        throw new Error(await responseErrorMessage(response, response.status === 403 ? "Bạn không có quyền giao công việc này." : "Không thể tạo công việc."));
      }
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
      notify(attachmentWarning ? "error" : "success", attachmentWarning || (journalismMode ? "Đã tạo công việc nghiệp vụ báo chí." : "Đã giao công việc thành công."));
      if (attachmentWarning) setMessage(`Đã tạo công việc, nhưng ${attachmentWarning.toLowerCase()} Bạn có thể tải tệp tại trang chi tiết.`);
      router.push(`/tasks/${result.task.id}`);
      router.refresh();
    } catch (error) {
      const text = errorMessage(error, journalismMode ? "Không thể tạo công việc nghiệp vụ báo chí. Vui lòng thử lại." : "Có lỗi xảy ra."); setMessage(text); notify("error", text);
    } finally { submittingRef.current = false; setBusy(false); }
  };

  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 lg:flex-row lg:gap-4">
      <AppNav currentPath="/tasks/assign" userLabel={userLabel} onLogout={() => { logout(); router.replace("/login"); }} />
      <main className="min-w-0 flex-1">
        <header className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold sm:text-3xl">GIAO VIỆC</h1>
          </div>
          <nav aria-label="Loại công việc cần tạo" className="mt-4 flex flex-wrap items-center gap-2">
            <Link href="/tasks/assign" aria-current={!journalismMode ? "page" : undefined} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${!journalismMode ? "border-orange-500 bg-orange-50 text-orange-800" : "text-slate-700"}`}>Công việc thường</Link>
            <Link href="/tasks/assign?kind=journalism" aria-current={journalismMode ? "page" : undefined} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${journalismMode ? "border-orange-500 bg-orange-50 text-orange-800" : "text-slate-700"}`}>Công việc nghiệp vụ báo chí</Link>
            <EventAssignmentPanel people={eventPeople} compact />
          </nav>
        </header>
        <form onSubmit={submit} className="mt-3 grid items-start gap-x-4 gap-y-3 rounded-xl border bg-white p-4 shadow-sm lg:grid-cols-2">
            <div className="grid gap-3 lg:col-span-2 lg:grid-cols-3">
            <Field label="Tên công việc"><input name="title" required maxLength={500} className={controlClass} /></Field>
                {journalismMode ? <Field label="Phòng ban"><input name="departmentId" type="hidden" value={editorialDepartment?.id ?? ""} /><div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-orange-900">{editorialDepartment?.name ?? "Phòng Nội dung"}</div>{!editorialDepartment ? <span role="alert" className="font-normal text-red-700">Không tìm thấy Phòng Nội dung; không thể tạo công việc.</span> : null}</Field> : <Field label="Phòng ban / nhóm"><select name="departmentId" required value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setAssigneeId(""); setExcludedMemberIds([]); setCollaboratorIds([]); setWatcherIds([]); }} className={controlClass}><option value="">Chọn phòng ban</option>{departments.map((department) => <option key={department.id} value={department.id} disabled={!department.hasManager}>{department.name}{department.hasManager ? "" : " — thiếu Trưởng phòng chính"}</option>)}</select></Field>}
            {isEditorialBoard ? <p className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900 lg:col-span-2">Ban Biên tập mặc định: Tổng biên tập là trưởng phòng; thành viên gồm Phó Tổng biên tập và các Trưởng phòng.</p> : null}
              <Field label="Cách chọn người"><select value={assignmentMode} disabled={journalismMode} onChange={(e) => { setAssignmentMode(e.target.value as "individual" | "department_group"); setExcludedMemberIds([]); setCollaboratorIds([]); }} className={controlClass}><option value="individual">Cá nhân</option>{!journalismMode ? <option value="department_group">Nhóm phòng ban</option> : null}</select>{journalismMode ? <span className="font-normal text-slate-500">Journalism v1 dùng người thực hiện cá nhân; cộng tác viên và người theo dõi vẫn giữ nguyên.</span> : null}</Field>
          </div>
          {departmentId ? <div role={managerLabel ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm lg:col-span-2 ${managerLabel ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {managerLabel
              ? `Theo dõi mặc định: ${managerLabel}. Hệ thống kiểm tra lại Trưởng phòng chính hiện hành khi lưu.`
              : "Phòng ban này chưa có Trưởng phòng chính; không thể giao việc."}
          </div> : null}
          <Field label="Các yêu cầu" wide><div className="grid gap-2">{requirements.map((value, index) => <div key={index} className="flex gap-2"><input name="requirements" required value={value} onChange={(event) => setRequirements((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} maxLength={2000} placeholder={`Yêu cầu ${index + 1}`} className={controlClass} />{requirements.length > 1 ? <button type="button" onClick={() => setRequirements((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded border px-3 text-red-700">Xóa</button> : null}</div>)}<button type="button" onClick={() => setRequirements((current) => [...current, ""])} className="justify-self-start rounded border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-700">+ Thêm yêu cầu</button></div></Field>
          {journalismMode ? <section aria-label="Nghiệp vụ báo chí" className="grid gap-3 rounded-xl border border-orange-200 bg-orange-50/60 p-3 lg:col-span-2 lg:grid-cols-2"><div className="lg:col-span-2"><h2 className="font-bold text-orange-900">Nghiệp vụ báo chí</h2><p className="mt-1 text-sm text-orange-900">Trạng thái ban đầu: Chưa xuất bản</p></div><Field label="Loại nghiệp vụ *"><select name="workKindId" required disabled={!journalismWorkKindsLoaded || journalismWorkKinds.length === 0} defaultValue="" aria-invalid={Boolean(journalismErrors.workKindId)} aria-describedby={journalismErrors.workKindId ? "journalism-work-kind-error" : undefined} className={controlClass}><option value="">Chọn loại nghiệp vụ</option>{journalismWorkKinds.map((kind) => <option key={kind.id} value={kind.id}>{kind.name}</option>)}</select>{journalismErrors.workKindId ? <span id="journalism-work-kind-error" role="alert" className="font-normal text-red-700">Trường này bắt buộc.</span> : null}{!journalismWorkKindsLoaded || journalismWorkKinds.length === 0 ? <span role="alert" className="font-normal text-red-700">Không thể tải danh sách loại nghiệp vụ.</span> : null}</Field><fieldset className="grid gap-1 text-sm font-semibold"><legend>Dự kiến xuất bản</legend><div className="grid grid-cols-2 gap-2"><input name="plannedPublicationDate" type="date" aria-label="Ngày dự kiến xuất bản" className={controlClass} /><input name="plannedPublicationTime" type="time" aria-label="Giờ dự kiến xuất bản" step="60" className={controlClass} /></div>{journalismErrors.plannedPublicationAt ? <span role="alert" className="font-normal text-red-700">Nhập đủ ngày và giờ hợp lệ.</span> : null}</fieldset><Field label="Địa điểm"><input name="location" maxLength={500} aria-invalid={Boolean(journalismErrors.location)} aria-describedby={journalismErrors.location ? "journalism-location-error" : undefined} className={controlClass} />{journalismErrors.location ? <span id="journalism-location-error" role="alert" className="font-normal text-red-700">Tối đa 500 ký tự.</span> : null}</Field><Field label="Ghi chú biên tập" wide><textarea name="editorialNotes" maxLength={10000} aria-invalid={Boolean(journalismErrors.editorialNotes)} aria-describedby={journalismErrors.editorialNotes ? "journalism-notes-error" : undefined} rows={4} className={controlClass} />{journalismErrors.editorialNotes ? <span id="journalism-notes-error" role="alert" className="font-normal text-red-700">Tối đa 10.000 ký tự.</span> : null}</Field></section> : null}
          <div className="grid gap-3 lg:col-span-2 lg:grid-cols-4">
            <Field label="Người chịu trách nhiệm chính"><select name="assigneeId" required value={assigneeId} className={controlClass} onChange={(event) => { setAssigneeId(event.target.value); setExcludedMemberIds((current) => current.filter((id) => id !== event.target.value)); setCollaboratorIds((current) => current.filter((id) => id !== event.target.value)); setWatcherIds((current) => current.filter((id) => id !== event.target.value)); }}><option value="">Chọn người thực hiện</option>{scopedPeople.map(personOption)}</select></Field>
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 lg:flex lg:items-center">Người duyệt tự động là người giao việc.</p>
            <Field label="Hạn hoàn thành"><div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2"><input name="dueDate" aria-label="Ngày hoàn thành" type="date" required className={controlClass} /><input name="dueTime" aria-label="Giờ hoàn thành" type="time" required defaultValue="17:00" step="60" className={controlClass} /></div></Field>
            {!journalismMode ? <Field label="Lặp lại"><select name="recurrenceFrequency" value={recurrenceFrequency} onChange={(e) => setRecurrenceFrequency(e.target.value)} className={controlClass}><option value="">Không lặp</option><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></Field> : null}
          </div>
          {!journalismMode ? (recurrenceFrequency ? <Field label="Ngày kết thúc lặp"><input name="recurrenceEndsOn" type="date" className={controlClass} /></Field> : <input name="recurrenceEndsOn" type="hidden" value="" />) : null}
              {assignmentMode === "individual" ? <Field label="Người phối hợp"><CheckGroup name="collaboratorIds" people={scopedPeople.filter((person) => person.id !== assigneeId)} selected={collaboratorIds} onChange={setCollaboratorIds} empty="Không còn người phù hợp trong phòng." /></Field> : <Field label="Danh sách thành viên active" wide><input type="hidden" name="groupDepartmentId" value={departmentId} />{excludedMemberIds.map((id) => <input key={id} type="hidden" name="excludedMemberIds" value={id} />)}<div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">{scopedPeople.map((person) => { const primary = person.id === assigneeId; const manager = person.id === selectedDepartment?.managerId; const fixed = primary || manager; return <label key={person.id} className="flex items-center gap-2 rounded bg-slate-50 px-3 py-2 text-sm"><input type="checkbox" disabled={fixed} checked={fixed || !excludedMemberIds.includes(person.id)} onChange={(event) => setExcludedMemberIds((current) => event.target.checked ? current.filter((id) => id !== person.id) : [...new Set([...current, person.id])])} /><span>{person.fullName}{primary ? " — Người chịu trách nhiệm chính" : manager ? " — Trưởng phòng, theo dõi tự động" : ""}</span></label>; })}{scopedPeople.length === 0 ? <p className="text-sm text-slate-500">Chưa có thành viên active.</p> : null}</div><span className="font-normal text-slate-500">Bỏ chọn để loại thành viên; server sẽ tải lại membership hiện hành khi lưu. Người chịu trách nhiệm chính và Trưởng phòng không thể bị loại.</span></Field>}
          <Field label="Người theo dõi bổ sung"><CheckGroup name="watcherIds" people={people.filter((person) => person.id !== assigneeId && !collaboratorIds.includes(person.id))} selected={watcherIds} onChange={setWatcherIds} empty="Không còn người phù hợp." /><span className="font-normal text-slate-500">Trưởng phòng chính được thêm tự động; lựa chọn trùng sẽ được gộp.</span></Field>
          <Field label="Đính kèm riêng tư"><input name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" className={controlClass} /></Field>
          <div className="flex items-end"><button disabled={busy || !departmentId || !selectedDepartment?.managerId || (journalismMode && (!journalismWorkKindsLoaded || journalismWorkKinds.length === 0))} aria-busy={busy} className="w-full rounded-lg bg-orange-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Đang tạo…" : journalismMode ? "Tạo công việc nghiệp vụ báo chí" : "Giao việc"}</button></div>
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
