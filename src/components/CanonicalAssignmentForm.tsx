"use client";
import TaskLinkDraftFields from "@/components/TaskLinkDraftFields";
import type { TaskLinkInput } from "@/lib/taskLinkPolicy";
import CameraCaptureButton from "@/components/CameraCaptureButton";


import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { AssignmentDepartment, AssignmentPerson, AssignmentScope, CollaboratorCandidate } from "@/lib/taskAssignmentRepository";
import { addTaskCard, buildBatchPayload, createTaskCard, MAX_TASK_CARDS, removeTaskCard, validateTaskCards } from "@/lib/taskAssignmentCards.mjs";
import ParticipantSelector, { type ParticipantPanel } from "@/components/ParticipantSelector";
import Time24hInput from "@/components/Time24hInput";

const controlClass = "min-w-0 focus:outline-none focus:ring-2 focus:ring-orange-400 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900";

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
  links?: TaskLinkInput[];
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
  collaboratorCandidates,
  assignmentScope = null,
  actorRoleCode,
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = "Giao việc",
  disabled = false,
  singleTaskOnly: requestedSingleTaskOnly = false,
  projectMode,
  disableAttachments = false,
  optionalDeadline = false,
}: {
  departments: AssignmentDepartment[];
  people: AssignmentPerson[];
  collaboratorCandidates?: CollaboratorCandidate[];
  assignmentScope?: AssignmentScope | null;
  actorRoleCode?: string;
  initialValues?: CanonicalAssignmentInitialValues;
  onSubmit: (value: CanonicalAssignmentSubmit) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  disabled?: boolean;
  singleTaskOnly?: boolean;
  projectMode?: { hostDepartmentId: string; currentUserId: string; leads: AssignmentPerson[] };
  disableAttachments?: boolean;
  optionalDeadline?: boolean;
}) {
  const singleTaskOnly = Boolean(projectMode) || requestedSingleTaskOnly;
  const [reviewerId, setReviewerId] = useState(projectMode ? (projectMode.leads.find(person => person.id === projectMode.currentUserId)?.id ?? projectMode.leads[0]?.id ?? "") : "");
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
    links: [],
  };
  const initialCards = (initialValues?.cards?.length ? initialValues.cards : [initialCard]).map((value, index) => ({
    ...createTaskCard(`card-${index + 1}`),
    ...Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)),
    requirements: value.requirements ?? [""],
    collaboratorIds: value.collaboratorIds ?? [],
    watcherIds: value.watcherIds ?? [],
    attachment: value.attachment ?? null,
    links: value.links ?? [],
  })) as AssignmentCardState[];
  const [departmentId, setDepartmentId] = useState(projectMode?.hostDepartmentId ?? initialValues?.departmentId ?? assignmentScope?.departmentId ?? "");
  const [assigneeId, setAssigneeId] = useState(initialValues?.assigneeId ?? "");
  const [formActivated, setFormActivated] = useState(Boolean(initialValues?.assigneeId));
  const [choosingOtherDepartment, setChoosingOtherDepartment] = useState(false);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<"individual" | "department_group">(singleTaskOnly ? "individual" : (initialValues?.assignmentMode ?? "individual"));
  const [excludedMemberIds, setExcludedMemberIds] = useState<string[]>(initialValues?.excludedMemberIds ?? []);
  const [taskCards, setTaskCards] = useState<AssignmentCardState[]>(initialCards);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<number, Record<string, string>>>({});
  const cardTitleRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const firstCardIdRef = useRef<string | undefined>(taskCards[0]?.cardId);
  // Read via ref so the auto-focus effect does not re-run (and steal focus) on every card keystroke.
  // eslint-disable-next-line react-hooks/refs -- Keep the latest callbacks available to the stable assignment controller.
  firstCardIdRef.current = taskCards[0]?.cardId;
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selectedDepartment = departments.find((department) => department.id === departmentId);
  const scopedPeople = useMemo(() => projectMode ? people : people.filter((person) => (person.memberDepartmentIds ?? [person.departmentId]).includes(departmentId)), [departmentId, people, projectMode]);
  const collaboratorPeople = projectMode ? people : collaboratorCandidates ?? scopedPeople;
  const departmentById = useMemo(() => new Map(departments.map((department) => [department.id, department.name])), [departments]);
  const filteredRecipientPeople = useMemo(() => {
    const query = recipientSearch.trim().toLocaleLowerCase();
    return scopedPeople.filter((person) => !query || person.fullName.toLocaleLowerCase().includes(query));
  }, [recipientSearch, scopedPeople]);
  const selectedAssignee = people.find((person) => person.id === assigneeId) ?? null;
  const managerLabel = selectedDepartment?.managerId ? people.find((person) => person.id === selectedDepartment.managerId)?.fullName ?? "Trưởng phòng chính" : null;
  const recipientReady = Boolean(assigneeId && (projectMode || selectedDepartment));
  const canChooseOtherDepartment = Boolean(assignmentScope?.canChooseOtherDepartment);
  const isEditorialBoard = selectedDepartment?.code === "leadership";
  const isTbt = actorRoleCode === "tong_bien_tap";

  useEffect(() => {
    if (formActivated && recipientReady) window.requestAnimationFrame(() => cardTitleRefs.current[firstCardIdRef.current ?? ""]?.focus());
  }, [formActivated, recipientReady]);

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
    const nextDepartmentId = (person.memberDepartmentIds ?? [person.departmentId]).includes(departmentId) ? departmentId : person.departmentId;
    if (!nextDepartmentId) return;
    setDepartmentId(nextDepartmentId); setAssigneeId(person.id); setExcludedMemberIds([]); setChoosingOtherDepartment(false);
    setRecipientPickerOpen(false); setRecipientSearch(""); setFormActivated(true); setBatchId(null); resetTransientState();
  };
  const changeRecipient = () => {
    setAssigneeId(""); setExcludedMemberIds([]); setDepartmentId(assignmentScope?.departmentId ?? ""); setChoosingOtherDepartment(false);
    setRecipientPickerOpen(false); setRecipientSearch(""); setFormActivated(false); setBatchId(null); resetTransientState();
  };
  const addTask = () => {
    if (singleTaskOnly) return;
    const cardId = `card-${Date.now()}-${taskCards.length + 1}`;
    setTaskCards((current) => addTaskCard(current, cardId) as AssignmentCardState[]);
    setBatchId(null);
    window.requestAnimationFrame(() => cardTitleRefs.current[cardId]?.focus());
  };
  const removeTask = (index: number) => { setTaskCards((current) => removeTaskCard(current, index) as AssignmentCardState[]); setBatchId(null); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recipientReady || !departmentId || !assigneeId) { setMessage("Vui lòng chọn người nhận việc trước."); return; }
    const validation = validateTaskCards(taskCards, { requireDeadline: !optionalDeadline });
    if (validation.length) {
      const first = validation[0]; setCardErrors({ [first.taskIndex]: { [first.field]: first.message } }); setMessage(first.message);
      window.requestAnimationFrame(() => cardTitleRefs.current[taskCards[first.taskIndex]?.cardId]?.focus()); return;
    }
    if (taskCards.length > 1 && assignmentMode === "department_group") { setMessage("Giao nhiều việc chưa hỗ trợ chế độ nhóm phòng ban. Hãy chọn Cá nhân hoặc giao từng việc riêng."); return; }
    if (submitting || disabled) return;
    setSubmitting(true); setMessage("");
    const currentBatchId = !singleTaskOnly && taskCards.length > 1 ? (batchId ?? crypto.randomUUID()) : null;
    if (currentBatchId) setBatchId(currentBatchId);
    const payload = !singleTaskOnly && taskCards.length > 1
      ? buildBatchPayload({ batchId: currentBatchId, departmentId, assigneeId, cards: taskCards })
      : { title: taskCards[0].title.trim(), description: taskCards[0].description.trim(), requirements: taskCards[0].requirements.filter((item) => item.trim()), departmentId, assigneeId, dueDate: taskCards[0].dueDate || null, dueTime: taskCards[0].dueDate ? taskCards[0].dueTime || "17:00" : null, evaluationCriteria: null, priority: taskCards[0].priority, collaboratorIds: taskCards[0].collaboratorIds, watcherIds: taskCards[0].watcherIds, recurrenceFrequency: taskCards[0].recurrenceFrequency, recurrenceEndsOn: taskCards[0].recurrenceEndsOn, reviewerId: projectMode ? reviewerId : assigneeId, groupDepartmentId: assignmentMode === "department_group" ? departmentId : null, excludedMemberIds: assignmentMode === "department_group" ? excludedMemberIds : [] };
    try { await onSubmit({ departmentId, assigneeId, assignmentMode, excludedMemberIds, cards: taskCards, payload }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Không thể giao công việc. Vui lòng thử lại."); }
    finally { setSubmitting(false); }
  };

  const effectiveSubmitLabel = submitLabel === "Giao việc" && taskCards.length > 1 ? `Giao ${taskCards.length} việc` : submitLabel;
  const handleDepartmentChange = (nextDepartmentId: string) => {
    setDepartmentId(nextDepartmentId);
    setAssigneeId("");
    setExcludedMemberIds([]);
    setFormActivated(false);
    setRecipientPickerOpen(false);
    setRecipientSearch("");
    setBatchId(null);
    resetTransientState();
  };
  const handleAssignmentModeChange = (nextMode: "individual" | "department_group") => {
    setAssignmentMode(nextMode);
    setExcludedMemberIds([]);
  };
  const groupMemberChecklist = assignmentMode === "department_group" && departmentId ? <Field label="Danh sách thành viên đang hoạt động" wide><input type="hidden" name="groupDepartmentId" value={departmentId} />{excludedMemberIds.map((id) => <input key={id} type="hidden" name="excludedMemberIds" value={id} />)}<div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">{scopedPeople.map((person) => { const primary = person.id === assigneeId; const manager = person.id === selectedDepartment?.managerId; const fixed = primary || manager; return <label key={person.id} className="flex items-center gap-2 rounded bg-slate-50 px-3 py-2 text-sm"><input type="checkbox" disabled={fixed || submitting || disabled} checked={fixed || !excludedMemberIds.includes(person.id)} onChange={(event) => setExcludedMemberIds((current) => event.target.checked ? current.filter((id) => id !== person.id) : [...new Set([...current, person.id])])} /><span>{person.fullName}{primary ? " — Người chịu trách nhiệm chính" : manager ? " — Trưởng phòng, theo dõi tự động" : ""}</span></label>; })}{scopedPeople.length === 0 ? <p className="text-sm text-slate-500">Chưa có thành viên đang hoạt động.</p> : null}</div><span className="font-normal text-slate-500">Bỏ chọn để loại thành viên; server sẽ tải lại membership hiện hành.</span></Field> : null;
  const recipientControls = <div className="grid gap-3 p-4">
    {!singleTaskOnly ? <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-semibold">Cách giao</legend>
      <div className="flex flex-wrap gap-2">{(["individual", "department_group"] as const).map((mode) => <label key={mode} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50"><input type="radio" name="assignmentMode" value={mode} checked={assignmentMode === mode} disabled={mode === "department_group" && taskCards.length > 1} onChange={() => handleAssignmentModeChange(mode)} /><span>{mode === "individual" ? "Cá nhân" : "Nhóm phòng ban"}</span></label>)}</div>
      {taskCards.length > 1 ? <p className="text-sm font-normal text-slate-500">Giao nhiều việc chưa hỗ trợ chế độ nhóm phòng ban. Hãy chọn Cá nhân hoặc giao từng việc riêng.</p> : null}
    </fieldset> : <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Chỉ tạo một công việc từ mỗi mục kế hoạch.</p>}
    {assignmentScope?.kind === "own_department" ? <p className="text-sm font-semibold text-slate-700">Phòng ban: {assignmentScope.departmentName ?? selectedDepartment?.name ?? "Chưa xác định phòng ban"}</p> : canChooseOtherDepartment && (choosingOtherDepartment || !assignmentScope?.departmentId) ? <div className="grid gap-2 sm:max-w-md"><label className="grid gap-1 text-sm font-semibold"><span>Phòng ban</span><select value={departmentId} onChange={(event) => handleDepartmentChange(event.target.value)} disabled={disabled} className={controlClass}><option value="">Chọn phòng ban</option>{departments.map((department) => <option key={department.id} value={department.id} disabled={!department.hasManager && !isTbt}>{department.name}{department.hasManager || isTbt ? "" : " — thiếu Trưởng phòng chính"}</option>)}</select></label>{assignmentScope?.departmentId ? <button type="button" onClick={() => { handleDepartmentChange(assignmentScope.departmentId ?? ""); setChoosingOtherDepartment(false); }} className="justify-self-start text-sm font-semibold text-orange-700">Quay về Ban Biên tập</button> : null}</div> : canChooseOtherDepartment && assignmentScope?.departmentId && !choosingOtherDepartment ? <><p className="text-sm font-semibold text-slate-700">Phòng ban: {selectedDepartment?.name ?? assignmentScope.departmentName ?? "Chưa xác định phòng ban"}</p><button type="button" onClick={() => { setChoosingOtherDepartment(true); handleDepartmentChange(""); }} className="justify-self-start rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">Chọn phòng ban khác</button></> : <label className="grid gap-1 text-sm font-semibold sm:max-w-md"><span>Phòng ban</span><select value={departmentId} onChange={(event) => handleDepartmentChange(event.target.value)} disabled={disabled} className={controlClass}><option value="">Chọn phòng ban</option>{departments.map((department) => <option key={department.id} value={department.id} disabled={!department.hasManager && !isTbt}>{department.name}{department.hasManager || isTbt ? "" : " — thiếu Trưởng phòng chính"}</option>)}</select></label>}
    <div className="relative sm:max-w-xl"><span className="mb-1 block text-sm font-semibold">Người nhận việc</span><input type="text" id="recipient-search" role="combobox" aria-controls="recipient-options" aria-haspopup="listbox" aria-autocomplete="list" aria-expanded={recipientPickerOpen} value={recipientSearch} onFocus={() => { if (departmentId) setRecipientPickerOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setRecipientPickerOpen(false); }} onChange={(event) => { setRecipientSearch(event.target.value); if (departmentId) setRecipientPickerOpen(true); }} placeholder={departmentId ? (isEditorialBoard ? "Tìm người trong Ban Biên tập..." : "Tìm hoặc chọn nhân viên...") : "Chọn phòng ban trước"} aria-label="Người nhận việc" disabled={!departmentId || disabled} className={controlClass + " disabled:bg-slate-100 disabled:text-slate-500"} />{recipientPickerOpen && departmentId ? <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"><div id="recipient-options" role="listbox" aria-label="Danh sách người nhận việc" className="max-h-64 overflow-y-auto p-1">{filteredRecipientPeople.map((person) => <button key={person.id} type="button" role="option" aria-selected="false" onClick={() => chooseRecipient(person)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-orange-50"><span className="block font-semibold text-slate-950">{person.fullName}</span><span className="block text-xs text-slate-500">{person.departmentId ? departmentById.get(person.departmentId) ?? selectedDepartment?.name : selectedDepartment?.name}</span></button>)}{filteredRecipientPeople.length === 0 ? <p className="px-3 py-4 text-sm text-slate-500">Không tìm thấy nhân sự phù hợp.</p> : null}</div></div> : null}</div>
    {departmentId ? <div role={managerLabel || isTbt ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm ${managerLabel || isTbt ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{managerLabel ? `Theo dõi mặc định: ${managerLabel}. Hệ thống kiểm tra lại Trưởng phòng chính hiện hành khi lưu.` : isTbt ? "Tổng biên tập có thể giao việc cho nhân sự active trong phòng ban này." : "Phòng ban này chưa có Trưởng phòng chính; không thể giao việc."}</div> : null}
    {!formActivated ? groupMemberChecklist : null}
  </div>;
  const projectRecipientControls = projectMode ? <section className="grid gap-3 rounded-xl border border-orange-200 bg-orange-50/50 p-4 sm:grid-cols-2 lg:col-span-2"><p className="border-l-4 border-orange-500 pl-3 text-sm font-semibold text-orange-900 sm:col-span-2">{assigneeId ? "Người nhận việc và người duyệt" : "Chọn người nhận việc trước"}</p><Field label={"Ng\u01b0\u1eddi nh\u1eadn vi\u1ec7c"}><select className={controlClass} value={assigneeId} disabled={disabled || submitting} onChange={(event) => { setAssigneeId(event.target.value); setFormActivated(Boolean(event.target.value)); resetTransientState(); }}><option value="">{"Ch\u1ecdn th\u00e0nh vi\u00ean d\u1ef1 \u00e1n"}</option>{people.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</select></Field><Field label={"Ng\u01b0\u1eddi duy\u1ec7t"}><select className={controlClass} value={reviewerId} disabled={disabled || submitting} onChange={(event) => setReviewerId(event.target.value)}>{projectMode.leads.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</select></Field></section> : null;
  return <>
    {projectMode ? null : <section aria-labelledby="recipient-heading" className="mt-3 overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm"><div className="border-b border-orange-100 bg-orange-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">Bước đầu tiên</p><h2 id="recipient-heading" className="mt-1 text-lg font-bold text-slate-950">CHỌN NGƯỜI NHẬN VIỆC</h2></div>{formActivated && selectedAssignee && selectedDepartment ? <><div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"><span className="text-sm font-medium text-slate-500">Đang giao việc cho:</span><span className="min-w-0 flex-1 font-bold text-slate-950">{assignmentMode === "department_group" ? `Nhóm phòng ban — chính: ${selectedAssignee.fullName}` : selectedAssignee.fullName} <span className="font-medium text-slate-400">·</span> {selectedDepartment.name}</span><button type="button" onClick={changeRecipient} className="rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-sm font-semibold text-orange-700">Đổi người</button></div>{assignmentMode === "department_group" && formActivated ? groupMemberChecklist : null}</> : recipientControls}</section>}
    <form onSubmit={submit} className="mt-3 grid items-start gap-x-4 gap-y-3 rounded-xl border bg-white p-4 shadow-sm lg:grid-cols-2">{projectRecipientControls}<input type="hidden" name="recipientReady" disabled={!recipientReady} value="true" readOnly /><fieldset disabled={!recipientReady || disabled} className="contents disabled:opacity-60"><input type="hidden" name="departmentId" value={departmentId} /><div className="grid gap-3 lg:col-span-2"><p className="text-sm text-slate-600">Sau khi chọn người nhận, thêm từng việc trong các thẻ bên dưới.</p></div><section aria-label="Danh sách công việc" className="grid gap-3 lg:col-span-2">{taskCards.map((card, index) => <TaskCardFields key={card.cardId} card={card} index={index} selectedAssigneeId={assigneeId} people={scopedPeople} collaboratorCandidates={collaboratorPeople} errors={cardErrors[index] ?? {}} busy={submitting || disabled} registerTitle={(element) => { cardTitleRefs.current[card.cardId] = element; }} onChange={(patch) => updateTaskCard(index, patch)} onRemove={() => removeTask(index)} allowRemove={!singleTaskOnly && taskCards.length > 1} disableAttachments={disableAttachments} optionalDeadline={optionalDeadline} hideRecurrence={Boolean(projectMode)} disableRecurrence={singleTaskOnly} />)}{!singleTaskOnly ? <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={addTask} disabled={submitting || disabled || singleTaskOnly || taskCards.length >= MAX_TASK_CARDS || assignmentMode === "department_group"} className="rounded-lg border border-orange-300 px-4 py-2 font-semibold text-orange-700 disabled:opacity-50">+ Thêm việc</button>{assignmentMode === "department_group" ? <span className="text-sm text-slate-500">Chọn Cá nhân để thêm nhiều thẻ việc.</span> : null}<span className="text-sm text-slate-500">{taskCards.length}/{MAX_TASK_CARDS} việc</span></div> : null}</section><div className="mobile-form-actions items-end lg:col-span-2"><button type="submit" disabled={submitting || disabled || !recipientReady || !departmentId || (!projectMode && !selectedDepartment?.managerId && !isTbt)} aria-busy={submitting} className="rounded-lg bg-orange-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{submitting ? "Đang tạo…" : effectiveSubmitLabel}</button>{onCancel ? <button type="button" disabled={submitting} onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700">Hủy</button> : null}</div>{message ? <p role="alert" className="text-sm text-red-700 lg:col-span-2">{message}</p> : null}</fieldset></form>
  </>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) { return <label className={`grid self-start gap-1 text-sm font-semibold ${wide ? "lg:col-span-2" : ""}`}><span>{label}</span>{children}</label>; }

function TaskCardFields({ optionalDeadline, card, index, selectedAssigneeId, people, collaboratorCandidates, errors, busy, registerTitle, onChange, onRemove, allowRemove, disableAttachments, disableRecurrence, hideRecurrence }: { optionalDeadline: boolean; card: AssignmentCardState; index: number; selectedAssigneeId: string; people: AssignmentPerson[]; collaboratorCandidates: CollaboratorCandidate[]; errors: Record<string, string>; busy: boolean; registerTitle: (element: HTMLInputElement | null) => void; onChange: (patch: Partial<AssignmentCardState>) => void; onRemove: () => void; allowRemove: boolean; disableAttachments?: boolean; disableRecurrence?: boolean; hideRecurrence?: boolean; }) {
  const [openPanel, setOpenPanel] = useState<ParticipantPanel | null>(null);
  return <article aria-labelledby={`${card.cardId}-heading`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2"><h3 id={`${card.cardId}-heading`} className="font-bold text-slate-950">VIỆC {index + 1}</h3>{allowRemove ? <button type="button" disabled={busy} onClick={onRemove} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">Xóa việc</button> : null}</div><div className="grid items-start gap-3 lg:grid-cols-2"><Field label="Tên công việc"><input ref={registerTitle} value={card.title} onChange={(event) => onChange({ title: event.target.value })} maxLength={500} aria-invalid={Boolean(errors.title)} className={controlClass} />{errors.title ? <span role="alert" className="font-normal text-red-700">{errors.title}</span> : null}</Field><Field label={optionalDeadline ? "Hạn hoàn thành (không bắt buộc)" : "Hạn hoàn thành"}><div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2"><input value={card.dueDate} onChange={(event) => onChange({ dueDate: event.target.value })} type="date" aria-invalid={Boolean(errors.dueDate)} className={controlClass} /><Time24hInput value={card.dueTime} onChange={(event) => onChange({ dueTime: event.target.value })} className={controlClass} /></div>{optionalDeadline ? <span className="font-normal text-slate-500">Có thể đặt hạn sau trong chi tiết công việc.</span> : null}{errors.dueDate || errors.dueTime ? <span role="alert" className="font-normal text-red-700">{errors.dueDate || errors.dueTime}</span> : null}</Field><Field label="Mô tả" wide><textarea value={card.description} onChange={(event) => onChange({ description: event.target.value })} maxLength={10000} rows={3} aria-invalid={Boolean(errors.description)} className={controlClass} />{errors.description ? <span role="alert" className="font-normal text-red-700">{errors.description}</span> : null}</Field><Field label="Yêu cầu" wide><div className="grid gap-2">{card.requirements.map((value, requirementIndex) => <div key={`${card.cardId}-requirement-${requirementIndex}`} className="mobile-form-actions"><input value={value} onChange={(event) => onChange({ requirements: card.requirements.map((item, itemIndex) => itemIndex === requirementIndex ? event.target.value : item) })} maxLength={2000} placeholder={`Yêu cầu ${requirementIndex + 1}`} aria-invalid={Boolean(errors.requirements)} className={controlClass} />{card.requirements.length > 1 ? <button type="button" disabled={busy} onClick={() => onChange({ requirements: card.requirements.length > 1 ? card.requirements.filter((_, itemIndex) => itemIndex !== requirementIndex) : [""] })} className="rounded border px-3 text-red-700 disabled:opacity-50">Xóa</button> : null}</div>)}<button type="button" disabled={busy} onClick={() => onChange({ requirements: [...card.requirements, ""] })} className="justify-self-start rounded border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-700 disabled:opacity-50">+ Thêm yêu cầu</button>{errors.requirements ? <span role="alert" className="font-normal text-red-700">{errors.requirements}</span> : null}</div></Field><Field label="Mức độ ưu tiên"><select value={card.priority} onChange={(event) => onChange({ priority: event.target.value as AssignmentCardState["priority"] })} className={controlClass}><option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option><option value="urgent">Khẩn cấp</option></select></Field>{hideRecurrence ? null : disableRecurrence ? <Field label="Lặp lại"><p className="rounded-lg border border-dashed border-slate-300 bg-slate-100 px-3 py-2.5 font-normal text-slate-600">Không lặp lại trong giao việc từ kế hoạch phòng.</p></Field> : <Field label="Lặp lại"><div className="grid gap-2"><select value={card.recurrenceFrequency ?? ""} disabled={disableRecurrence} onChange={(event) => onChange({ recurrenceFrequency: (event.target.value || null) as AssignmentCardState["recurrenceFrequency"], recurrenceEndsOn: event.target.value ? card.recurrenceEndsOn : null })} className={controlClass}><option value="">Không lặp</option><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select>{card.recurrenceFrequency ? <input name="recurrenceEndsOn" value={card.recurrenceEndsOn ?? ""} onChange={(event) => onChange({ recurrenceEndsOn: event.target.value || null })} type="date" className={controlClass} /> : null}</div></Field>}<ParticipantSelector disabled={busy} label="Người phối hợp" name={`collaborators-${card.cardId}`} people={collaboratorCandidates.filter((person) => person.id !== selectedAssigneeId)} selected={card.collaboratorIds} onChange={(ids) => onChange({ collaboratorIds: ids })} empty="Không còn người phù hợp." panel="collaborator" openPanel={openPanel} setOpenPanel={setOpenPanel} /><ParticipantSelector disabled={busy} label="Người theo dõi" name={`watchers-${card.cardId}`} people={people.filter((person) => person.id !== selectedAssigneeId && !card.collaboratorIds.includes(person.id))} selected={card.watcherIds} onChange={(ids) => onChange({ watcherIds: ids })} empty="Không còn người phù hợp." panel="watcher" openPanel={openPanel} setOpenPanel={setOpenPanel} /><Field label="Đính kèm riêng tư"><input name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" disabled={busy || disableAttachments} onChange={(event) => onChange({ attachment: event.target.files?.[0] ?? null })} className={controlClass} /><CameraCaptureButton disabled={busy || disableAttachments} onCapture={(file) => onChange({ attachment: file })} />{card.attachment ? <span className="break-all text-xs font-normal text-slate-600">{card.attachment.name}</span> : null}</Field>{!disableAttachments ? <div className="grid gap-1"><TaskLinkDraftFields links={card.links ?? []} disabled={busy} onChange={links => onChange({ links })} /></div> : null}</div></article>;
}
