"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { AssignmentDepartment, AssignmentPerson, AssignmentScope } from "@/lib/taskAssignmentRepository";
import { addTaskCard, buildBatchPayload, createTaskCard, MAX_TASK_CARDS, removeTaskCard, validateTaskCards } from "@/lib/taskAssignmentCards.mjs";

const controlClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900";

export type AssignmentCardState = {
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

export type CanonicalAssignmentInitialValues = {
  departmentId?: string;
  assigneeId?: string;
  title?: string;
  content?: string;
  description?: string;
  requirements?: string[];
  dueDate?: string;
  dueTime?: string;
  priority?: AssignmentCardState["priority"];
  collaboratorIds?: string[];
  watcherIds?: string[];
  recurrenceFrequency?: AssignmentCardState["recurrenceFrequency"];
  recurrenceEndsOn?: string | null;
  assignmentMode?: "individual" | "department_group";
  excludedMemberIds?: string[];
  cards?: Array<Partial<AssignmentCardState>>;
};

export type CanonicalAssignmentSubmit = {
  departmentId: string;
  assigneeId: string;
  assignmentMode: "individual" | "department_group";
  excludedMemberIds: string[];
  cards: AssignmentCardState[];
  payload: Record<string, unknown>;
};

export default function CanonicalAssignmentForm({
  departments,
  people,
  assignmentScope = null,
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = "Giao việc",
  disabled = false,
}: {
  departments: AssignmentDepartment[];
  people: AssignmentPerson[];
  assignmentScope?: AssignmentScope | null;
  initialValues?: CanonicalAssignmentInitialValues;
  onSubmit: (value: CanonicalAssignmentSubmit) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const initialCard = {
    title: initialValues?.title,
    description: initialValues?.description ?? initialValues?.content,
    requirements: initialValues?.requirements,
    dueDate: initialValues?.dueDate,
    dueTime: initialValues?.dueTime,
    priority: initialValues?.priority,
    collaboratorIds: initialValues?.collaboratorIds,
    watcherIds: initialValues?.watcherIds,
    recurrenceFrequency: initialValues?.recurrenceFrequency,
    recurrenceEndsOn: initialValues?.recurrenceEndsOn,
    attachment: undefined,
  };
  const initialCards = (initialValues?.cards?.length ? initialValues.cards : [initialCard]).map((value, index) => ({
    ...createTaskCard(`card-${index + 1}`),
    ...value,
    requirements: value.requirements ?? [""],
    collaboratorIds: value.collaboratorIds ?? [],
    watcherIds: value.watcherIds ?? [],
    attachment: value.attachment ?? null,
  })) as AssignmentCardState[];
  const [departmentId, setDepartmentId] = useState(initialValues?.departmentId ?? assignmentScope?.departmentId ?? "");
  const [assigneeId, setAssigneeId] = useState(initialValues?.assigneeId ?? "");
  const [formActivated, setFormActivated] = useState(Boolean(initialValues?.assigneeId));
  const [choosingOtherDepartment, setChoosingOtherDepartment] = useState(false);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<"individual" | "department_group">(initialValues?.assignmentMode ?? "individual");
  const [excludedMemberIds, setExcludedMemberIds] = useState<string[]>(initialValues?.excludedMemberIds ?? []);
  const [taskCards, setTaskCards] = useState<AssignmentCardState[]>(initialCards);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<number, Record<string, string>>>({});
  const cardTitleRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selectedDepartment = departments.find((department) => department.id === departmentId);
  const scopedPeople = useMemo(() => people.filter((person) => person.departmentId === departmentId), [departmentId, people]);
  const departmentById = useMemo(() => new Map(departments.map((department) => [department.id, department.name])), [departments]);
  const filteredRecipientPeople = useMemo(() => {
    const query = recipientSearch.trim().toLocaleLowerCase();
    return scopedPeople.filter((person) => !query || person.fullName.toLocaleLowerCase().includes(query));
  }, [recipientSearch, scopedPeople]);
  const selectedAssignee = people.find((person) => person.id === assigneeId) ?? null;
  const managerLabel = selectedDepartment?.managerId ? people.find((person) => person.id === selectedDepartment.managerId)?.fullName ?? "Trưởng phòng chính" : null;
  const recipientReady = Boolean(assigneeId && selectedDepartment);
  const canChooseOtherDepartment = Boolean(assignmentScope?.canChooseOtherDepartment);
  const isEditorialBoard = selectedDepartment?.code === "leadership";

  useEffect(() => {
    if (recipientReady && formActivated) window.requestAnimationFrame(() => cardTitleRefs.current[taskCards[0]?.cardId]?.focus());
  }, [formActivated, recipientReady, taskCards]);

  const resetTransientState = () => {
    setCardErrors({});
    setMessage("");
  };
  const updateTaskCard = (index: number, patch: Partial<AssignmentCardState>) => {
    setTaskCards((current) => current.map((card, cardIndex) => cardIndex === index ? { ...card, ...patch } : card));
    setBatchId(null);
    setCardErrors((current) => { const next = { ...current }; delete next[index]; return next; });
  };
  const chooseRecipient = (person: AssignmentPerson) => {
    if (!person.departmentId) return;
    setDepartmentId(person.departmentId); setAssigneeId(person.id); setExcludedMemberIds([]); setChoosingOtherDepartment(false);
    setRecipientPickerOpen(false); setRecipientSearch(""); setFormActivated(true); setBatchId(null); resetTransientState();
  };
  const changeRecipient = () => {
    setAssigneeId(""); setExcludedMemberIds([]); setDepartmentId(assignmentScope?.departmentId ?? ""); setChoosingOtherDepartment(false);
    setRecipientPickerOpen(false); setRecipientSearch(""); setFormActivated(false); setBatchId(null); resetTransientState();
  };
  const addTask = () => {
    const cardId = `card-${Date.now()}-${taskCards.length + 1}`;
    setTaskCards((current) => addTaskCard(current, cardId) as AssignmentCardState[]);
    setBatchId(null);
    window.requestAnimationFrame(() => cardTitleRefs.current[cardId]?.focus());
  };
  const removeTask = (index: number) => { setTaskCards((current) => removeTaskCard(current, index) as AssignmentCardState[]); setBatchId(null); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recipientReady || !departmentId || !assigneeId) { setMessage("Vui lòng chọn người nhận việc trước."); return; }
    const validation = validateTaskCards(taskCards);
    if (validation.length) {
      const first = validation[0]; setCardErrors({ [first.taskIndex]: { [first.field]: first.message } }); setMessage(first.message);
      window.requestAnimationFrame(() => cardTitleRefs.current[taskCards[first.taskIndex]?.cardId]?.focus()); return;
    }
    if (taskCards.length > 1 && assignmentMode === "department_group") { setMessage("Giao nhiều việc chưa hỗ trợ chế độ nhóm phòng ban. Hãy chọn Cá nhân hoặc giao từng việc riêng."); return; }
    if (submitting || disabled) return;
    setSubmitting(true); setMessage("");
    const currentBatchId = taskCards.length > 1 ? (batchId ?? crypto.randomUUID()) : null;
    if (currentBatchId) setBatchId(currentBatchId);
    const payload = taskCards.length > 1
      ? buildBatchPayload({ batchId: currentBatchId, departmentId, assigneeId, cards: taskCards })
      : { title: taskCards[0].title.trim(), description: taskCards[0].description.trim(), requirements: taskCards[0].requirements.filter((item) => item.trim()), departmentId, assigneeId, dueDate: taskCards[0].dueDate, dueTime: taskCards[0].dueTime, evaluationCriteria: null, priority: taskCards[0].priority, collaboratorIds: taskCards[0].collaboratorIds, watcherIds: taskCards[0].watcherIds, recurrenceFrequency: taskCards[0].recurrenceFrequency, recurrenceEndsOn: taskCards[0].recurrenceEndsOn, reviewerId: assigneeId, groupDepartmentId: assignmentMode === "department_group" ? departmentId : null, excludedMemberIds: assignmentMode === "department_group" ? excludedMemberIds : [] };
    try { await onSubmit({ departmentId, assigneeId, assignmentMode, excludedMemberIds, cards: taskCards, payload }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Không thể giao công việc. Vui lòng thử lại."); }
    finally { setSubmitting(false); }
  };

  const effectiveSubmitLabel = submitLabel === "Giao việc" && taskCards.length > 1 ? `Giao ${taskCards.length} việc` : submitLabel;
  return <>
    <section aria-labelledby="recipient-heading" className="mt-3 overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm">
      <div className="border-b border-orange-100 bg-orange-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">Bước đầu tiên</p><h2 id="recipient-heading" className="mt-1 text-lg font-bold text-slate-950">CHỌN NGƯỜI NHẬN VIỆC</h2></div>
      {formActivated && selectedAssignee && selectedDepartment ? <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"><span className="text-sm font-medium text-slate-500">Đang giao việc cho:</span><span className="min-w-0 flex-1 font-bold text-slate-950">{selectedAssignee.fullName} <span className="font-medium text-slate-400">·</span> {selectedDepartment.name}</span><button type="button" onClick={changeRecipient} className="rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-sm font-semibold text-orange-700">Đổi người</button></div> : <div className="grid gap-3 p-4"><div className="grid items-end gap-3 md:grid-cols-[minmax(0,520px)_1fr]"><div className="relative"><span className="mb-1 block text-sm font-semibold">Người nhận việc</span><input type="text" id="recipient-search" role="combobox" aria-controls="recipient-options" aria-haspopup="listbox" aria-autocomplete="list" aria-expanded={recipientPickerOpen} value={recipientSearch} onFocus={() => { if (departmentId) setRecipientPickerOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setRecipientPickerOpen(false); }} onChange={(event) => { setRecipientSearch(event.target.value); if (departmentId) setRecipientPickerOpen(true); }} placeholder={departmentId ? (isEditorialBoard ? "Tìm người trong Ban Biên tập..." : "Tìm hoặc chọn nhân viên...") : "Chọn phòng ban trước"} aria-label="Người nhận việc" disabled={!departmentId || disabled} className={controlClass + " disabled:bg-slate-100 disabled:text-slate-500"} />{recipientPickerOpen && departmentId ? <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"><div id="recipient-options" role="listbox" aria-label="Danh sách người nhận việc" className="max-h-64 overflow-y-auto p-1">{filteredRecipientPeople.map((person) => <button key={person.id} type="button" role="option" aria-selected="false" onClick={() => chooseRecipient(person)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-orange-50"><span className="block font-semibold text-slate-950">{person.fullName}</span><span className="block text-xs text-slate-500">{person.departmentId ? departmentById.get(person.departmentId) ?? selectedDepartment?.name : selectedDepartment?.name}</span></button>)}{filteredRecipientPeople.length === 0 ? <p className="px-3 py-4 text-sm text-slate-500">Không tìm thấy nhân sự phù hợp.</p> : null}</div></div> : null}</div>{assignmentScope?.kind === "own_department" ? <p className="pb-2 text-sm font-semibold text-slate-700">Phạm vi: {assignmentScope.departmentName ?? "Chưa xác định phòng ban"}</p> : selectedDepartment && !choosingOtherDepartment ? <p className="pb-2 text-sm font-semibold text-slate-700">Phạm vi: {selectedDepartment.name}</p> : null}</div>{canChooseOtherDepartment && assignmentScope?.departmentId && !choosingOtherDepartment ? <button type="button" onClick={() => { setChoosingOtherDepartment(true); setDepartmentId(""); setRecipientPickerOpen(false); setRecipientSearch(""); }} className="justify-self-start rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">Chọn phòng ban khác</button> : null}{canChooseOtherDepartment && (choosingOtherDepartment || !assignmentScope?.departmentId) ? <div className="grid gap-2 p-4 pt-0 sm:max-w-md"><label className="grid gap-1 text-sm font-semibold"><span>Phòng ban</span><select value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setRecipientPickerOpen(false); setRecipientSearch(""); }} disabled={disabled} className={controlClass}><option value="">Chọn phòng ban</option>{departments.map((department) => <option key={department.id} value={department.id} disabled={!department.hasManager}>{department.name}{department.hasManager ? "" : " — thiếu Trưởng phòng chính"}</option>)}</select></label>{assignmentScope?.departmentId ? <button type="button" onClick={() => { setDepartmentId(assignmentScope.departmentId ?? ""); setChoosingOtherDepartment(false); }} className="justify-self-start text-sm font-semibold text-orange-700">Quay về Ban Biên tập</button> : null}</div> : null}</div>}
    </section>
    <form onSubmit={submit} className="mt-3 grid items-start gap-x-4 gap-y-3 rounded-xl border bg-white p-4 shadow-sm lg:grid-cols-2"><input type="hidden" name="recipientReady" disabled={!recipientReady} value="true" readOnly /><fieldset disabled={!recipientReady || disabled} className="contents disabled:opacity-60"><input type="hidden" name="departmentId" value={departmentId} /><div className="grid gap-3 lg:col-span-2"><p className="text-sm text-slate-600">Sau khi chọn người nhận, thêm từng việc trong các thẻ bên dưới.</p><Field label="Cách chọn người"><select value={assignmentMode} onChange={(event) => { setAssignmentMode(event.target.value as "individual" | "department_group"); setExcludedMemberIds([]); }} className={controlClass}><option value="individual">Cá nhân</option><option value="department_group">Nhóm phòng ban</option></select></Field></div>{departmentId ? <div role={managerLabel ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm lg:col-span-2 ${managerLabel ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{managerLabel ? `Theo dõi mặc định: ${managerLabel}. Hệ thống kiểm tra lại Trưởng phòng chính hiện hành khi lưu.` : "Phòng ban này chưa có Trưởng phòng chính; không thể giao việc."}</div> : null}<section aria-label="Danh sách công việc" className="grid gap-3 lg:col-span-2">{taskCards.map((card, index) => <TaskCardFields key={card.cardId} card={card} index={index} selectedAssigneeId={assigneeId} people={scopedPeople} errors={cardErrors[index] ?? {}} busy={submitting || disabled} registerTitle={(element) => { cardTitleRefs.current[card.cardId] = element; }} onChange={(patch) => updateTaskCard(index, patch)} onRemove={() => removeTask(index)} allowRemove={taskCards.length > 1} />)}<div className="flex flex-wrap items-center gap-3"><button type="button" onClick={addTask} disabled={submitting || disabled || taskCards.length >= MAX_TASK_CARDS || assignmentMode === "department_group"} className="rounded-lg border border-orange-300 px-4 py-2 font-semibold text-orange-700 disabled:opacity-50">+ Thêm việc</button>{assignmentMode === "department_group" ? <span className="text-sm text-slate-500">Chọn Cá nhân để thêm nhiều thẻ việc.</span> : null}<span className="text-sm text-slate-500">{taskCards.length}/{MAX_TASK_CARDS} việc</span></div></section>{assignmentMode === "department_group" && taskCards.length === 1 ? <Field label="Danh sách thành viên đang hoạt động" wide><input type="hidden" name="groupDepartmentId" value={departmentId} />{excludedMemberIds.map((id) => <input key={id} type="hidden" name="excludedMemberIds" value={id} />)}<div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">{scopedPeople.map((person) => { const primary = person.id === assigneeId; const manager = person.id === selectedDepartment?.managerId; const fixed = primary || manager; return <label key={person.id} className="flex items-center gap-2 rounded bg-slate-50 px-3 py-2 text-sm"><input type="checkbox" disabled={fixed || submitting || disabled} checked={fixed || !excludedMemberIds.includes(person.id)} onChange={(event) => setExcludedMemberIds((current) => event.target.checked ? current.filter((id) => id !== person.id) : [...new Set([...current, person.id])])} /><span>{person.fullName}{primary ? " — Người chịu trách nhiệm chính" : manager ? " — Trưởng phòng, theo dõi tự động" : ""}</span></label>; })}{scopedPeople.length === 0 ? <p className="text-sm text-slate-500">Chưa có thành viên đang hoạt động.</p> : null}</div><span className="font-normal text-slate-500">Bỏ chọn để loại thành viên; server sẽ tải lại membership hiện hành.</span></Field> : null}<div className="flex items-end gap-2 lg:col-span-2"><button type="submit" disabled={submitting || disabled || !recipientReady || !departmentId || !selectedDepartment?.managerId} aria-busy={submitting} className="rounded-lg bg-orange-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{submitting ? "Đang tạo…" : effectiveSubmitLabel}</button>{onCancel ? <button type="button" disabled={submitting} onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700">Hủy</button> : null}</div>{message ? <p role="alert" className="text-sm text-red-700 lg:col-span-2">{message}</p> : null}</fieldset></form>
  </>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) { return <label className={`grid self-start gap-1 text-sm font-semibold ${wide ? "lg:col-span-2" : ""}`}><span>{label}</span>{children}</label>; }

function TaskCardFields({ card, index, selectedAssigneeId, people, errors, busy, registerTitle, onChange, onRemove, allowRemove }: { card: AssignmentCardState; index: number; selectedAssigneeId: string; people: AssignmentPerson[]; errors: Record<string, string>; busy: boolean; registerTitle: (element: HTMLInputElement | null) => void; onChange: (patch: Partial<AssignmentCardState>) => void; onRemove: () => void; allowRemove: boolean; }) {
  const [openPanel, setOpenPanel] = useState<ParticipantPanel | null>(null);
  return <article aria-labelledby={`${card.cardId}-heading`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2"><h3 id={`${card.cardId}-heading`} className="font-bold text-slate-950">VIỆC {index + 1}</h3>{allowRemove ? <button type="button" disabled={busy} onClick={onRemove} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">Xóa việc</button> : null}</div><div className="grid gap-3 lg:grid-cols-2"><Field label="Tên công việc"><input ref={registerTitle} value={card.title} onChange={(event) => onChange({ title: event.target.value })} maxLength={500} aria-invalid={Boolean(errors.title)} className={controlClass} />{errors.title ? <span role="alert" className="font-normal text-red-700">{errors.title}</span> : null}</Field><Field label="Hạn hoàn thành"><div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2"><input value={card.dueDate} onChange={(event) => onChange({ dueDate: event.target.value })} type="date" aria-invalid={Boolean(errors.dueDate)} className={controlClass} /><input value={card.dueTime} onChange={(event) => onChange({ dueTime: event.target.value })} type="time" step="60" className={controlClass} /></div>{errors.dueDate || errors.dueTime ? <span role="alert" className="font-normal text-red-700">{errors.dueDate || errors.dueTime}</span> : null}</Field><Field label="Mô tả" wide><textarea value={card.description} onChange={(event) => onChange({ description: event.target.value })} maxLength={10000} rows={3} aria-invalid={Boolean(errors.description)} className={controlClass} />{errors.description ? <span role="alert" className="font-normal text-red-700">{errors.description}</span> : null}</Field><Field label="Yêu cầu" wide><div className="grid gap-2">{card.requirements.map((value, requirementIndex) => <div key={`${card.cardId}-requirement-${requirementIndex}`} className="flex gap-2"><input value={value} onChange={(event) => onChange({ requirements: card.requirements.map((item, itemIndex) => itemIndex === requirementIndex ? event.target.value : item) })} maxLength={2000} placeholder={`Yêu cầu ${requirementIndex + 1}`} aria-invalid={Boolean(errors.requirements)} className={controlClass} />{card.requirements.length > 1 ? <button type="button" disabled={busy} onClick={() => onChange({ requirements: card.requirements.length > 1 ? card.requirements.filter((_, itemIndex) => itemIndex !== requirementIndex) : [""] })} className="rounded border px-3 text-red-700 disabled:opacity-50">Xóa</button> : null}</div>)}<button type="button" disabled={busy} onClick={() => onChange({ requirements: [...card.requirements, ""] })} className="justify-self-start rounded border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-700 disabled:opacity-50">+ Thêm yêu cầu</button>{errors.requirements ? <span role="alert" className="font-normal text-red-700">{errors.requirements}</span> : null}</div></Field><Field label="Mức độ ưu tiên"><select value={card.priority} onChange={(event) => onChange({ priority: event.target.value as AssignmentCardState["priority"] })} className={controlClass}><option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option><option value="urgent">Khẩn cấp</option></select></Field><Field label="Lặp lại"><div className="grid gap-2"><select value={card.recurrenceFrequency ?? ""} onChange={(event) => onChange({ recurrenceFrequency: (event.target.value || null) as AssignmentCardState["recurrenceFrequency"], recurrenceEndsOn: event.target.value ? card.recurrenceEndsOn : null })} className={controlClass}><option value="">Không lặp</option><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select>{card.recurrenceFrequency ? <input name="recurrenceEndsOn" value={card.recurrenceEndsOn ?? ""} onChange={(event) => onChange({ recurrenceEndsOn: event.target.value || null })} type="date" className={controlClass} /> : null}</div></Field><ParticipantSelector label="Người phối hợp" name={`collaborators-${card.cardId}`} people={people.filter((person) => person.id !== selectedAssigneeId)} selected={card.collaboratorIds} onChange={(ids) => onChange({ collaboratorIds: ids })} empty="Không còn người phù hợp trong phòng." panel="collaborator" openPanel={openPanel} setOpenPanel={setOpenPanel} /><ParticipantSelector label="Người theo dõi" name={`watchers-${card.cardId}`} people={people.filter((person) => person.id !== selectedAssigneeId && !card.collaboratorIds.includes(person.id))} selected={card.watcherIds} onChange={(ids) => onChange({ watcherIds: ids })} empty="Không còn người phù hợp." panel="watcher" openPanel={openPanel} setOpenPanel={setOpenPanel} /><Field label="Đính kèm riêng tư"><input name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" disabled={busy} onChange={(event) => onChange({ attachment: event.target.files?.[0] ?? null })} className={controlClass} /></Field></div></article>;
}

type ParticipantPanel = "collaborator" | "watcher";
function ParticipantSelector({ label, name, people, selected, onChange, empty, panel, openPanel, setOpenPanel }: { label: string; name: string; people: AssignmentPerson[]; selected: string[]; onChange: (ids: string[]) => void; empty: string; panel: ParticipantPanel; openPanel: ParticipantPanel | null; setOpenPanel: (panel: ParticipantPanel | null) => void; }) {
  const rootRef = useRef<HTMLDivElement>(null); const [search, setSearch] = useState(""); const isOpen = openPanel === panel;
  const selectedNames = selected.map((id) => people.find((person) => person.id === id)?.fullName).filter((name): name is string => Boolean(name));
  const filteredPeople = people.filter((person) => person.fullName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  useEffect(() => { if (!isOpen) return; const handlePointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpenPanel(null); }; const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenPanel(null); }; document.addEventListener("pointerdown", handlePointerDown); document.addEventListener("keydown", handleKeyDown); return () => { document.removeEventListener("pointerdown", handlePointerDown); document.removeEventListener("keydown", handleKeyDown); }; }, [isOpen, setOpenPanel]);
  const summary = selectedNames.length === 0 ? `Chọn ${label.toLocaleLowerCase()}` : selectedNames.length <= 2 ? selectedNames.join(", ") : `${selectedNames.slice(0, 2).join(", ")} +${selectedNames.length - 2}`;
  return <div ref={rootRef} className="relative grid gap-1 text-sm font-semibold"><span>{label}</span><button type="button" aria-expanded={isOpen} aria-haspopup="listbox" onClick={() => { setSearch(""); setOpenPanel(isOpen ? null : panel); }} className={`${controlClass} flex min-h-[46px] items-center justify-between gap-2 text-left`}><span className="min-w-0 truncate font-normal">{summary}</span><span aria-hidden="true" className="shrink-0 text-slate-500">▾</span></button>{isOpen ? <div role="listbox" aria-label={label} className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2 shadow-lg"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên nhân viên" aria-label={`Tìm ${label.toLocaleLowerCase()}`} className={`${controlClass} mb-2`} /><div className="space-y-0.5">{filteredPeople.map((person) => <label key={person.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 font-normal hover:bg-orange-50"><input name={name} type="checkbox" value={person.id} checked={selected.includes(person.id)} onChange={(event) => onChange(event.target.checked ? [...new Set([...selected, person.id])] : selected.filter((id) => id !== person.id))} /><span>{person.fullName}</span></label>)}{filteredPeople.length === 0 ? <p className="px-2 py-3 font-normal text-slate-500">{search ? "Không tìm thấy nhân viên phù hợp." : empty}</p> : null}</div></div> : null}</div>;
}
