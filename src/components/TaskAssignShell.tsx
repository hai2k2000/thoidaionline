"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type { AssignmentDepartment, AssignmentPerson, AssignmentScope } from "@/lib/taskAssignmentRepository";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import { buildJournalismCreatePayload, journalismCreateErrorMessage, serializeVietnamPlannedPublication, validateJournalismCreateFields } from "@/lib/journalismCreateUi.mjs";
import { journalismLabels } from "@/lib/journalismUi.mjs";
import { addTaskCard, buildBatchPayload, createTaskCard, MAX_TASK_CARDS, removeTaskCard, validateTaskCards } from "@/lib/taskAssignmentCards.mjs";

const controlClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900";

export default function TaskAssignShell({ departments, people, assignmentScope = null, userLabel, canManageEventAssignment, journalismMode, journalismSelfCreate = false, userId, journalismDepartment, journalismWorkKinds, journalismWorkKindsLoaded }: {
  departments: AssignmentDepartment[];
  people: AssignmentPerson[];
  assignmentScope?: AssignmentScope | null;
  userLabel: string;
  canManageEventAssignment: boolean;
  journalismMode: boolean;
  journalismSelfCreate?: boolean;
  userId?: string;
  journalismDepartment: AssignmentDepartment | null;
  journalismWorkKinds: { id: string; name: string; is_active: boolean }[];
  journalismWorkKindsLoaded: boolean;
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const { notify } = useActionFeedback();
  const [departmentId, setDepartmentId] = useState(journalismMode ? journalismDepartment?.id ?? "" : assignmentScope?.departmentId ?? "");
  const [assigneeId, setAssigneeId] = useState(journalismSelfCreate ? userId ?? "" : "");
  const [formActivated, setFormActivated] = useState(journalismMode || journalismSelfCreate);
  const [choosingOtherDepartment, setChoosingOtherDepartment] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<"individual" | "department_group">("individual");
  const [excludedMemberIds, setExcludedMemberIds] = useState<string[]>([]);
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [watcherIds, setWatcherIds] = useState<string[]>([]);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("");
  const [requirements, setRequirements] = useState([""]);
  const [taskCards, setTaskCards] = useState<AssignmentCardState[]>(() => [createTaskCard("card-1") as AssignmentCardState]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<number, Record<string, string>>>({});
  const cardTitleRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [journalismErrors, setJournalismErrors] = useState<Record<string, string>>({});
  const selectedDepartment = departments.find((department) => department.id === departmentId);
  const scopedPeople = useMemo(
    () => people.filter((person) => person.departmentId === departmentId),
    [departmentId, people],
  );
  const isEditorialBoard = selectedDepartment?.code === "leadership";
  const managerLabel = selectedDepartment?.managerId
    ? people.find((person) => person.id === selectedDepartment.managerId)?.fullName ?? "Trưởng phòng chính"
    : null;
  const selectedAssignee = people.find((person) => person.id === assigneeId) ?? null;
  const recipientReady = journalismSelfCreate || Boolean(assigneeId && selectedDepartment);
  const canChooseOtherDepartment = Boolean(assignmentScope && assignmentScope.canChooseOtherDepartment);

  const updateTaskCard = (index: number, patch: Record<string, unknown>) => {
    setTaskCards((current) => current.map((card, cardIndex) => cardIndex === index ? { ...card, ...patch } : card));
    setBatchId(null);
    setCardErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  };

  const addTask = () => {
    const cardId = `card-${Date.now()}-${taskCards.length + 1}`;
    setTaskCards((current) => addTaskCard(current, cardId));
    setBatchId(null);
    focusCardTitle(cardId);
  };

  const removeTask = (index: number) => {
    setTaskCards((current) => removeTaskCard(current, index));
    setBatchId(null);
    setCardErrors({});
  };

  const focusCardTitle = (cardId: string) => {
    window.requestAnimationFrame(() => cardTitleRefs.current[cardId]?.focus());
  };

  useEffect(() => {
    if (!journalismMode && recipientReady && formActivated) titleInputRef.current?.focus();
  }, [formActivated, journalismMode, recipientReady]);

  const chooseRecipient = (person: AssignmentPerson) => {
    if (!person.departmentId) return;
    setDepartmentId(person.departmentId);
    setAssigneeId(person.id);
    setExcludedMemberIds([]);
    setCollaboratorIds([]);
    setWatcherIds([]);
    setChoosingOtherDepartment(false);
    setFormActivated(true);
    setBatchId(null);
    focusCardTitle(taskCards[0]?.cardId ?? "");
  };

  const changeRecipient = () => {
    setAssigneeId("");
    setExcludedMemberIds([]);
    setCollaboratorIds([]);
    setWatcherIds([]);
    setDepartmentId(assignmentScope?.departmentId ?? "");
    setChoosingOtherDepartment(false);
    setFormActivated(false);
    setBatchId(null);
  };

  const submitGeneral = async () => {
    if (!recipientReady || !departmentId || !assigneeId) {
      const text = "Vui lòng chọn người nhận việc trước.";
      setMessage(text); notify("error", text); return;
    }
    const validation = validateTaskCards(taskCards);
    if (validation.length) {
      const first = validation[0];
      setCardErrors({ [first.taskIndex]: { [first.field]: first.message } });
      setMessage(first.message); notify("error", first.message);
      window.requestAnimationFrame(() => cardTitleRefs.current[taskCards[first.taskIndex]?.cardId]?.focus());
      return;
    }
    if (taskCards.length > 1 && taskCards.some((card) => card.attachment instanceof File && card.attachment.size > 0)) {
      const text = "Tệp đính kèm cho nhiều việc sẽ được hỗ trợ ở bước tiếp theo. Hãy bỏ tệp hoặc giao từng việc riêng.";
      setMessage(text); notify("error", text); return;
    }
    if (taskCards.length > 1 && assignmentMode === "department_group") {
      const text = "Giao nhiều việc chưa hỗ trợ chế độ nhóm phòng ban. Hãy chọn Cá nhân hoặc giao từng việc riêng.";
      setMessage(text); notify("error", text); return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true; setBusy(true); setMessage("");
    const currentBatchId = taskCards.length > 1 ? (batchId ?? crypto.randomUUID()) : null;
    if (currentBatchId) setBatchId(currentBatchId);
    try {
      const response = await fetch("/api/tasks/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(taskCards.length > 1
          ? buildBatchPayload({ batchId: currentBatchId, departmentId, assigneeId, cards: taskCards })
          : {
            title: taskCards[0].title.trim(), description: taskCards[0].description.trim(), requirements: taskCards[0].requirements.filter((item) => item.trim()),
            departmentId, assigneeId, dueDate: taskCards[0].dueDate, dueTime: taskCards[0].dueTime, evaluationCriteria: null,
            priority: taskCards[0].priority, collaboratorIds: taskCards[0].collaboratorIds, watcherIds: taskCards[0].watcherIds,
            recurrenceFrequency: taskCards[0].recurrenceFrequency, recurrenceEndsOn: taskCards[0].recurrenceEndsOn,
            reviewerId: assigneeId, groupDepartmentId: assignmentMode === "department_group" ? departmentId : null, excludedMemberIds: assignmentMode === "department_group" ? excludedMemberIds : [],
          }),
      });
      if (!response.ok) {
        if (response.status === 409 && currentBatchId) throw new Error("Batch ID đã được dùng cho dữ liệu khác. Không tự tạo mã mới; hãy kiểm tra lại phiên giao việc.");
        throw new Error(await responseErrorMessage(response, "Không thể giao công việc."));
      }
      const result = await response.json() as { task?: { id: string }; tasks?: Array<{ id: string }>; count?: number };
      const count = taskCards.length;
      const attachment = taskCards[0].attachment;
      let attachmentWarning = "";
      if (count === 1 && attachment instanceof File && attachment.size > 0 && result.task?.id) {
        const upload = new FormData(); upload.set("file", attachment);
        const uploaded = await fetch(`/api/tasks/${result.task.id}/attachments`, { method: "POST", body: upload });
        if (!uploaded.ok) attachmentWarning = await responseErrorMessage(uploaded, "Tệp đính kèm chưa tải lên được.");
      }
      const recipientName = selectedAssignee?.fullName ?? "người nhận việc";
      notify(attachmentWarning ? "error" : "success", attachmentWarning || `Đã giao ${count} công việc cho ${recipientName}.`);
      if (attachmentWarning) setMessage(attachmentWarning);
      router.push(count === 1 && result.task?.id ? `/tasks/${result.task.id}` : "/tasks");
      router.refresh();
    } catch (error) {
      const text = errorMessage(error, "Không thể giao công việc. Vui lòng thử lại."); setMessage(text); notify("error", text);
    } finally { submittingRef.current = false; setBusy(false); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!journalismMode) { await submitGeneral(); return; }
    if (submittingRef.current) return;
    if (journalismMode && (!journalismDepartment || departmentId !== journalismDepartment.id)) {
      const text = "Công việc nghiệp vụ báo chí chỉ thuộc Phòng Nội dung."; setMessage(text); notify("error", text); return;
    }
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
    if (journalismMode && journalismSelfCreate) payload.selfRegister = true;
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
      <AppNav currentPath={journalismMode ? "/journalism/tasks/new" : "/tasks/assign"} userLabel={userLabel} onLogout={() => { logout(); router.replace("/login"); }} />
      <main className="min-w-0 flex-1">
        <header className="rounded-2xl border bg-white p-4 shadow-sm">
          <h1 className="text-2xl font-bold sm:text-3xl">GIAO VIỆC</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!journalismMode ? <span className="rounded-lg border border-orange-500 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">Công việc thường</span> : <span className="rounded-lg border border-red-500 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">Công việc nghiệp vụ báo chí</span>}
            {canManageEventAssignment ? <a href="/work-schedule" className="ml-auto rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white">Phân công sự kiện</a> : null}
          </div>
        </header>
        {!journalismMode ? <section aria-labelledby="recipient-heading" className="mt-3 overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm">
          <div className="border-b border-orange-100 bg-orange-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">Bước đầu tiên</p>
            <h2 id="recipient-heading" className="mt-1 text-lg font-bold text-slate-950">CHỌN NGƯỜI NHẬN VIỆC</h2>
          </div>
          {formActivated && selectedAssignee && selectedDepartment ? <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Đang giao việc cho:</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{selectedAssignee.fullName} <span className="font-medium text-slate-400">·</span> {selectedDepartment.name}</p>
            </div>
            <button type="button" onClick={changeRecipient} className="rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">Đổi người</button>
          </div> : <div className="grid gap-4 p-4">
            <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">Vui lòng chọn người nhận việc trước</p>
            {assignmentScope?.kind === "own_department" ? <p className="text-sm font-semibold text-slate-700">Phạm vi: {assignmentScope.departmentName ?? "Chưa xác định phòng ban"}</p> : null}
            {assignmentScope?.canChooseOtherDepartment && canChooseOtherDepartment && assignmentScope.departmentId && !choosingOtherDepartment ? <button type="button" onClick={() => { setChoosingOtherDepartment(true); setDepartmentId(""); }} className="justify-self-start rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Chọn phòng ban khác</button> : null}
            {canChooseOtherDepartment && (choosingOtherDepartment || !assignmentScope?.departmentId) ? <div className="grid gap-2 sm:max-w-md">
              <label className="grid gap-1 text-sm font-semibold"><span>Phòng ban</span><select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className={controlClass}><option value="">Chọn phòng ban</option>{departments.map((department) => <option key={department.id} value={department.id} disabled={!department.hasManager}>{department.name}{department.hasManager ? "" : " — thiếu Trưởng phòng chính"}</option>)}</select></label>
              {assignmentScope?.departmentId ? <button type="button" onClick={() => { setDepartmentId(assignmentScope.departmentId ?? ""); setChoosingOtherDepartment(false); }} className="justify-self-start text-sm font-semibold text-orange-700 underline-offset-4 hover:underline">Quay về Ban Biên tập</button> : null}
            </div> : null}
            {departmentId ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{scopedPeople.map((person) => <button key={person.id} type="button" onClick={() => chooseRecipient(person)} className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-left hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><span className="block font-semibold text-slate-950">{person.fullName}</span><span className="mt-1 block text-xs text-slate-500">{selectedDepartment?.name}</span></button>)}{scopedPeople.length === 0 ? <p className="text-sm text-slate-500">Chưa có nhân sự phù hợp trong phòng ban này.</p> : null}</div> : null}
          </div>}
        </section> : null}
        <form onSubmit={submit} className="mt-3 grid items-start gap-x-4 gap-y-3 rounded-xl border bg-white p-4 shadow-sm lg:grid-cols-2">
          <input type="hidden" name="recipientReady" disabled={!recipientReady} value="true" readOnly />
          <fieldset disabled={!journalismMode && !recipientReady} className="contents disabled:opacity-60">
            <div className="grid gap-3 lg:col-span-2 lg:grid-cols-3">
            {journalismMode ? <Field label="Tên công việc"><input ref={titleInputRef} name="title" required maxLength={500} className={controlClass} /></Field> : <div className="lg:col-span-3"><p className="text-sm text-slate-600">Sau khi chọn người nhận, thêm từng việc trong các thẻ bên dưới.</p></div>}
                {journalismMode ? <div className="grid gap-1 text-sm font-semibold"><span>Phòng ban</span><input type="hidden" name="departmentId" value={journalismDepartment?.id ?? ""} /><div className={`${controlClass} bg-slate-100`} aria-readonly="true">Phòng Nội dung</div></div> : <input type="hidden" name="departmentId" value={departmentId} />}
            {isEditorialBoard ? <p className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900 lg:col-span-2">Ban Biên tập mặc định: Tổng biên tập là trưởng phòng; thành viên gồm Phó Tổng biên tập và các Trưởng phòng.</p> : null}
              <Field label="Cách chọn người"><select value={assignmentMode} disabled={journalismMode} onChange={(e) => { setAssignmentMode(e.target.value as "individual" | "department_group"); setExcludedMemberIds([]); setCollaboratorIds([]); }} className={controlClass}><option value="individual">Cá nhân</option>{!journalismMode ? <option value="department_group">Nhóm phòng ban</option> : null}</select>{journalismMode ? <span className="font-normal text-slate-500">Công việc nghiệp vụ báo chí dùng người thực hiện cá nhân; cộng tác viên và người theo dõi vẫn giữ nguyên.</span> : null}</Field>
          </div>
          {departmentId ? <div role={managerLabel ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm lg:col-span-2 ${managerLabel ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {managerLabel
              ? `Theo dõi mặc định: ${managerLabel}. Hệ thống kiểm tra lại Trưởng phòng chính hiện hành khi lưu.`
              : "Phòng ban này chưa có Trưởng phòng chính; không thể giao việc."}
          </div> : null}
          {journalismMode ? <Field label="Các yêu cầu" wide><div className="grid gap-2">{requirements.map((value, index) => <div key={index} className="flex gap-2"><input name="requirements" required value={value} onChange={(event) => setRequirements((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} maxLength={2000} placeholder={`Yêu cầu ${index + 1}`} className={controlClass} />{requirements.length > 1 ? <button type="button" onClick={() => setRequirements((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded border px-3 text-red-700">Xóa</button> : null}</div>)}<button type="button" onClick={() => setRequirements((current) => [...current, ""])} className="justify-self-start rounded border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-700">+ Thêm yêu cầu</button></div></Field> : <section aria-label="Danh sách công việc" className="grid gap-3 lg:col-span-2">
            {taskCards.map((card, index) => <TaskCardFields key={card.cardId} card={card} index={index} selectedAssigneeId={assigneeId} people={scopedPeople} errors={cardErrors[index] ?? {}} busy={busy} registerTitle={(element) => { cardTitleRefs.current[card.cardId] = element; }} onChange={(patch) => updateTaskCard(index, patch)} onRemove={() => removeTask(index)} allowRemove={taskCards.length > 1} />)}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={addTask} disabled={busy || taskCards.length >= MAX_TASK_CARDS || assignmentMode === "department_group"} className="rounded-lg border border-orange-300 px-4 py-2 font-semibold text-orange-700 disabled:opacity-50">+ Thêm việc</button>
              {assignmentMode === "department_group" ? <span className="text-sm text-slate-500">Chọn Cá nhân để thêm nhiều thẻ việc.</span> : null}
              <span className="text-sm text-slate-500">{taskCards.length}/{MAX_TASK_CARDS} việc</span>
              {taskCards.length >= MAX_TASK_CARDS ? <span className="text-sm font-medium text-amber-700">Đã đạt giới hạn 20 việc.</span> : null}
            </div>
          </section>}
          {!journalismMode && assignmentMode === "department_group" && taskCards.length === 1 ? <Field label="Danh sách thành viên đang hoạt động" wide><input type="hidden" name="groupDepartmentId" value={departmentId} />{excludedMemberIds.map((id) => <input key={id} type="hidden" name="excludedMemberIds" value={id} />)}<div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">{scopedPeople.map((person) => { const primary = person.id === assigneeId; const manager = person.id === selectedDepartment?.managerId; const fixed = primary || manager; return <label key={person.id} className="flex items-center gap-2 rounded bg-slate-50 px-3 py-2 text-sm"><input type="checkbox" disabled={fixed || busy} checked={fixed || !excludedMemberIds.includes(person.id)} onChange={(event) => setExcludedMemberIds((current) => event.target.checked ? current.filter((id) => id !== person.id) : [...new Set([...current, person.id])])} /><span>{person.fullName}{primary ? " — Người chịu trách nhiệm chính" : manager ? " — Trưởng phòng, theo dõi tự động" : ""}</span></label>; })}{scopedPeople.length === 0 ? <p className="text-sm text-slate-500">Chưa có thành viên đang hoạt động.</p> : null}</div><span className="font-normal text-slate-500">Bỏ chọn để loại thành viên; server sẽ tải lại membership hiện hành. Người chịu trách nhiệm chính và Trưởng phòng không thể bị loại.</span></Field> : null}
          {journalismMode ? <section aria-label="Nghiệp vụ báo chí" className="grid gap-3 rounded-xl border border-orange-200 bg-orange-50/60 p-3 lg:col-span-2 lg:grid-cols-2"><div className="lg:col-span-2"><h2 className="font-bold text-orange-900">Nghiệp vụ báo chí</h2><p className="mt-1 text-sm text-orange-900">Trạng thái ban đầu: Chưa xuất bản</p></div><Field label="Loại nghiệp vụ *"><select name="workKindId" required disabled={!journalismWorkKindsLoaded || journalismWorkKinds.length === 0} defaultValue="" aria-invalid={Boolean(journalismErrors.workKindId)} aria-describedby={journalismErrors.workKindId ? "journalism-work-kind-error" : undefined} className={controlClass}><option value="">Chọn loại nghiệp vụ</option>{journalismWorkKinds.map((kind) => <option key={kind.id} value={kind.id}>{kind.name}</option>)}</select>{journalismErrors.workKindId ? <span id="journalism-work-kind-error" role="alert" className="font-normal text-red-700">Trường này bắt buộc.</span> : null}{!journalismWorkKindsLoaded || journalismWorkKinds.length === 0 ? <span role="alert" className="font-normal text-red-700">Không thể tải danh sách loại nghiệp vụ.</span> : null}</Field><fieldset className="grid gap-1 text-sm font-semibold"><legend>{journalismLabels.plannedPublicationDate}</legend><div className="grid grid-cols-2 gap-2"><input name="plannedPublicationDate" type="date" aria-label="Ngày dự kiến xuất bản" className={controlClass} /><input name="plannedPublicationTime" type="time" aria-label="Giờ dự kiến xuất bản" step="60" className={controlClass} /></div>{journalismErrors.plannedPublicationAt ? <span role="alert" className="font-normal text-red-700">Nhập đủ ngày và giờ hợp lệ.</span> : null}</fieldset><Field label="Địa điểm"><input name="location" maxLength={500} aria-invalid={Boolean(journalismErrors.location)} aria-describedby={journalismErrors.location ? "journalism-location-error" : undefined} className={controlClass} />{journalismErrors.location ? <span id="journalism-location-error" role="alert" className="font-normal text-red-700">Tối đa 500 ký tự.</span> : null}</Field><Field label={journalismLabels.editorialNotes} wide><textarea name="editorialNotes" maxLength={10000} aria-invalid={Boolean(journalismErrors.editorialNotes)} aria-describedby={journalismErrors.editorialNotes ? "journalism-notes-error" : undefined} rows={4} className={controlClass} />{journalismErrors.editorialNotes ? <span id="journalism-notes-error" role="alert" className="font-normal text-red-700">Tối đa 10.000 ký tự.</span> : null}</Field></section> : null}
          {journalismMode ? <div className="grid gap-3 lg:col-span-2 lg:grid-cols-4">
            {journalismSelfCreate ? <div className="grid gap-1 text-sm font-semibold"><span>Người thực hiện</span><input type="hidden" name="assigneeId" value={userId ?? ""} /><div className={`${controlClass} bg-slate-100`} aria-readonly="true">Tôi (tự đăng ký)</div><span className="font-normal text-slate-500">Công việc sẽ vào Chờ duyệt giao việc; không thể giao cho người khác.</span></div> : journalismMode ? <Field label="Người chịu trách nhiệm chính"><select name="assigneeId" required value={assigneeId} className={controlClass} onChange={(event) => { setAssigneeId(event.target.value); setExcludedMemberIds((current) => current.filter((id) => id !== event.target.value)); setCollaboratorIds((current) => current.filter((id) => id !== event.target.value)); setWatcherIds((current) => current.filter((id) => id !== event.target.value)); }}><option value="">Chọn người thực hiện</option>{scopedPeople.map(personOption)}</select></Field> : <div className="grid gap-1 text-sm font-semibold"><span>Người nhận việc</span><input type="hidden" name="assigneeId" value={assigneeId} /><div className={`${controlClass} bg-slate-100`} aria-readonly="true">{selectedAssignee?.fullName ?? "Chưa chọn"}</div></div>}
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 lg:flex lg:items-center">Người duyệt tự động là người giao việc.</p>
            <Field label="Hạn hoàn thành"><div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2"><input name="dueDate" aria-label="Ngày hoàn thành" type="date" required className={controlClass} /><input name="dueTime" aria-label="Giờ hoàn thành" type="time" required defaultValue="17:00" step="60" className={controlClass} /></div></Field>
            {!journalismMode ? <Field label="Lặp lại"><select name="recurrenceFrequency" value={recurrenceFrequency} onChange={(e) => setRecurrenceFrequency(e.target.value)} className={controlClass}><option value="">Không lặp</option><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></Field> : null}
          </div> : null}
          {journalismMode ? (journalismSelfCreate ? null : assignmentMode === "individual" ? <Field label="Người phối hợp"><CheckGroup name="collaboratorIds" people={scopedPeople.filter((person) => person.id !== assigneeId)} selected={collaboratorIds} onChange={setCollaboratorIds} empty="Không còn người phù hợp trong phòng." /></Field> : <Field label="Danh sách thành viên đang hoạt động" wide><input type="hidden" name="groupDepartmentId" value={departmentId} />{excludedMemberIds.map((id) => <input key={id} type="hidden" name="excludedMemberIds" value={id} />)}<div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">{scopedPeople.map((person) => { const primary = person.id === assigneeId; const manager = person.id === selectedDepartment?.managerId; const fixed = primary || manager; return <label key={person.id} className="flex items-center gap-2 rounded bg-slate-50 px-3 py-2 text-sm"><input type="checkbox" disabled={fixed} checked={fixed || !excludedMemberIds.includes(person.id)} onChange={(event) => setExcludedMemberIds((current) => event.target.checked ? current.filter((id) => id !== person.id) : [...new Set([...current, person.id])])} /><span>{person.fullName}{primary ? " — Người chịu trách nhiệm chính" : manager ? " — Trưởng phòng, theo dõi tự động" : ""}</span></label>; })}{scopedPeople.length === 0 ? <p className="text-sm text-slate-500">Chưa có thành viên đang hoạt động.</p> : null}</div><span className="font-normal text-slate-500">Bỏ chọn để loại thành viên; server sẽ tải lại membership hiện hành khi lưu. Người chịu trách nhiệm chính và Trưởng phòng không thể bị loại.</span></Field>) : null}
          {journalismMode ? <>{!journalismSelfCreate ? <Field label="Người theo dõi bổ sung"><CheckGroup name="watcherIds" people={people.filter((person) => person.id !== assigneeId && !collaboratorIds.includes(person.id))} selected={watcherIds} onChange={setWatcherIds} empty="Không còn người phù hợp." /><span className="font-normal text-slate-500">Trưởng phòng chính được thêm tự động; lựa chọn trùng sẽ được gộp.</span></Field> : null}</> : null}
          {journalismMode ? <Field label="Đính kèm riêng tư"><input name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" className={controlClass} /></Field> : null}
          <div className="flex items-end"><button disabled={busy || !recipientReady || !departmentId || !selectedDepartment?.managerId || (journalismMode && (!journalismWorkKindsLoaded || journalismWorkKinds.length === 0))} aria-busy={busy} className="w-full rounded-lg bg-orange-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Đang tạo…" : journalismMode ? "Tạo công việc nghiệp vụ báo chí" : taskCards.length > 1 ? `Giao ${taskCards.length} việc` : "Giao việc"}</button></div>
          {message ? <p role="alert" className="text-sm text-red-700 lg:col-span-2">{message}</p> : null}
          </fieldset>
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

type AssignmentCardState = {
  cardId: string;
  title: string;
  description: string;
  requirements: string[];
  dueDate: string;
  dueTime: string;
  collaboratorIds: string[];
  watcherIds: string[];
  priority: "low" | "normal" | "high" | "urgent";
  recurrenceFrequency: "daily" | "weekly" | "monthly" | null;
  recurrenceEndsOn: string | null;
  attachment: File | null;
};

function TaskCardFields({ card, index, selectedAssigneeId, people, errors, busy, registerTitle, onChange, onRemove, allowRemove }: {
  card: AssignmentCardState;
  index: number;
  selectedAssigneeId: string;
  people: AssignmentPerson[];
  errors: Record<string, string>;
  busy: boolean;
  registerTitle: (element: HTMLInputElement | null) => void;
  onChange: (patch: Partial<AssignmentCardState>) => void;
  onRemove: () => void;
  allowRemove: boolean;
}) {
  const updateRequirement = (requirementIndex: number, value: string) => onChange({ requirements: card.requirements.map((item, itemIndex) => itemIndex === requirementIndex ? value : item) });
  const removeRequirement = (requirementIndex: number) => onChange({ requirements: card.requirements.length > 1 ? card.requirements.filter((_, itemIndex) => itemIndex !== requirementIndex) : [""] });
  return <article aria-labelledby={`${card.cardId}-heading`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2"><h3 id={`${card.cardId}-heading`} className="font-bold text-slate-950">VIỆC {index + 1}</h3>{allowRemove ? <button type="button" disabled={busy} onClick={onRemove} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">Xóa việc</button> : null}</div>
    <div className="grid gap-3 lg:grid-cols-2">
      <Field label="Tên công việc"><input ref={registerTitle} value={card.title} onChange={(event) => onChange({ title: event.target.value })} maxLength={500} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? `${card.cardId}-title-error` : undefined} className={controlClass} />{errors.title ? <span id={`${card.cardId}-title-error`} role="alert" className="font-normal text-red-700">{errors.title}</span> : null}</Field>
      <Field label="Hạn hoàn thành"><div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2"><input value={card.dueDate} onChange={(event) => onChange({ dueDate: event.target.value })} type="date" aria-invalid={Boolean(errors.dueDate)} className={controlClass} /><input value={card.dueTime} onChange={(event) => onChange({ dueTime: event.target.value })} type="time" step="60" aria-invalid={Boolean(errors.dueTime)} className={controlClass} /></div>{errors.dueDate || errors.dueTime ? <span role="alert" className="font-normal text-red-700">{errors.dueDate || errors.dueTime}</span> : null}</Field>
      <Field label="Mô tả" wide><textarea value={card.description} onChange={(event) => onChange({ description: event.target.value })} maxLength={10000} rows={3} aria-invalid={Boolean(errors.description)} className={controlClass} />{errors.description ? <span role="alert" className="font-normal text-red-700">{errors.description}</span> : null}</Field>
      <Field label="Yêu cầu" wide><div className="grid gap-2">{card.requirements.map((value, requirementIndex) => <div key={`${card.cardId}-requirement-${requirementIndex}`} className="flex gap-2"><input value={value} onChange={(event) => updateRequirement(requirementIndex, event.target.value)} maxLength={2000} placeholder={`Yêu cầu ${requirementIndex + 1}`} aria-invalid={Boolean(errors.requirements)} className={controlClass} />{card.requirements.length > 1 ? <button type="button" disabled={busy} onClick={() => removeRequirement(requirementIndex)} className="rounded border px-3 text-red-700 disabled:opacity-50">Xóa</button> : null}</div>)}<button type="button" disabled={busy} onClick={() => onChange({ requirements: [...card.requirements, ""] })} className="justify-self-start rounded border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-700 disabled:opacity-50">+ Thêm yêu cầu</button>{errors.requirements ? <span role="alert" className="font-normal text-red-700">{errors.requirements}</span> : null}</div></Field>
      <Field label="Mức độ ưu tiên"><select value={card.priority} onChange={(event) => onChange({ priority: event.target.value as AssignmentCardState["priority"] })} className={controlClass}><option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option><option value="urgent">Khẩn cấp</option></select></Field>
      <Field label="Lặp lại"><div className="grid gap-2"><select value={card.recurrenceFrequency ?? ""} onChange={(event) => onChange({ recurrenceFrequency: (event.target.value || null) as AssignmentCardState["recurrenceFrequency"], recurrenceEndsOn: event.target.value ? card.recurrenceEndsOn : null })} className={controlClass}><option value="">Không lặp</option><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select>{card.recurrenceFrequency ? <input value={card.recurrenceEndsOn ?? ""} onChange={(event) => onChange({ recurrenceEndsOn: event.target.value || null })} type="date" className={controlClass} /> : null}</div></Field>
      <Field label="Người phối hợp"><CheckGroup name={`collaborators-${card.cardId}`} people={people.filter((person) => person.id !== selectedAssigneeId)} selected={card.collaboratorIds} onChange={(ids) => onChange({ collaboratorIds: ids })} empty="Không còn người phù hợp trong phòng." /></Field>
      <Field label="Người theo dõi"><CheckGroup name={`watchers-${card.cardId}`} people={people.filter((person) => person.id !== selectedAssigneeId && !card.collaboratorIds.includes(person.id))} selected={card.watcherIds} onChange={(ids) => onChange({ watcherIds: ids })} empty="Không còn người phù hợp." /></Field>
      <Field label="Đính kèm riêng tư"><input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" disabled={busy} onChange={(event) => onChange({ attachment: event.target.files?.[0] ?? null })} className={controlClass} /><span className="font-normal text-slate-500">Giao nhiều việc sẽ xử lý tệp ở bước đính kèm riêng.</span></Field>
    </div>
  </article>;
}
