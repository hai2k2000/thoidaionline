"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { reconcileRecordFile, uploadRecordFiles, validateSelectedFiles } from "@/lib/databaseManagement/uploadClient.mjs";
import { validateRecordForm } from "@/lib/databaseManagement/formValidation.mjs";
import { CONTENT_ROOT_CODE, childCategories, filterLanguageRecordTypes, hasSubcategories, LANGUAGE_OPTIONS, selectableCategories } from "@/lib/databaseManagement/languageGroup.mjs";
import { isDepartmentOnlyRecordType } from "@/lib/databaseManagement/departmentOnlyTypes.mjs";
import { formatIsoDateVi, formatViDateInput, parseViDate } from "@/lib/databaseManagement/dateVi.mjs";

type FormField = { field_key: string; label: string; data_type: string; required: boolean; hidden?: boolean; help?: string | null; options?: Array<{ value: string; label: string }>; validation?: Record<string, unknown> };
type Catalog = { categories: Array<{ id: string; parent_id?: string | null; code: string; name: string }>; recordTypes: Array<{ id: string; category_id: string; code?: string; name: string; sort_order?: number | null }>; forms: Array<{ record_type_id: string; db_form_fields?: FormField[] }> };
type FieldError = { field: string; code: string };
type UploadItem = { file: File; uploadId: string; state: "pending" | "uploading" | "uploaded" | "failed" | "unknown"; code?: string };

const errorText: Record<string, string> = {
  required: "Vui lòng bổ sung thông tin này.", invalid_url: "Đường dẫn phải bắt đầu bằng https://.",
  file_too_large: "Tệp không được vượt quá 50 MB.", invalid_option: "Giá trị lựa chọn không hợp lệ.", invalid_type: "Định dạng dữ liệu không hợp lệ.",
  max_length: "Nội dung vượt quá số ký tự cho phép.", max_items: "Số lựa chọn vượt quá giới hạn.", invalid_title: "Vui lòng nhập tên hoặc trích yếu hồ sơ.",
};

function humanError(code: string) { return errorText[code] ?? "Dữ liệu chưa hợp lệ."; }
function formatBytes(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(2)} MB`; }

type Props = { mode: "create" | "edit"; catalog: Catalog; initial?: { id: string; categoryId: string; recordTypeId: string; recordCode: string; title: string; summary: string | null; metadata: Record<string, unknown>; visibility?: "department" | "public" } };

export default function DatabaseRecordForm({ mode, catalog, initial }: Props) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [languageCode, setLanguageCode] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [recordTypeId, setRecordTypeId] = useState(initial?.recordTypeId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [visibility, setVisibility] = useState<"department" | "public">(initial?.visibility === "public" && !isDepartmentOnlyRecordType(catalog.recordTypes.find((type) => type.id === initial?.recordTypeId)?.code) ? "public" : "department");
  const [metadata, setMetadata] = useState<Record<string, unknown>>(initial?.metadata ?? {});
  const [dateInputs, setDateInputs] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial?.metadata ?? {}).map(([key, value]) => [key, typeof value === "string" ? formatIsoDateVi(value) : ""])));
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [createdRecordId, setCreatedRecordId] = useState<string | null>(initial?.id ?? null);
  const [dragActive, setDragActive] = useState(false);
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>({});
  const formRef = useRef<HTMLDivElement>(null);
  const clientRequestId = useRef(initial?.id ? `record-edit-${initial.id}` : `record-create-${crypto.randomUUID()}`);
  const selectedCategory = catalog.categories.find((category) => category.id === categoryId);
  const subcategories = useMemo(() => childCategories(catalog.categories, categoryId).filter((category: Catalog["categories"][number]) => catalog.recordTypes.some((type) => type.category_id === category.id)), [catalog.categories, catalog.recordTypes, categoryId]);
  const requiresSubcategory = hasSubcategories(catalog.categories, selectedCategory);
  const types = useMemo(() => filterLanguageRecordTypes(catalog.recordTypes, catalog.categories, categoryId, languageCode || undefined, subcategoryId || undefined), [catalog.recordTypes, catalog.categories, categoryId, languageCode, subcategoryId]);
  const form = catalog.forms.find((item) => item.record_type_id === recordTypeId);
  const fields = form?.db_form_fields ?? [];
  const isDanhBa = isDepartmentOnlyRecordType(catalog.recordTypes.find((type) => type.id === recordTypeId)?.code);
  const fieldByKey = (key: string) => fields.find((field) => field.field_key === key);
  const titleField = fieldByKey("title");
  const summaryField = fieldByKey("summary");
  const fieldHelp = (field?: FormField) => field?.help ?? (typeof field?.validation?.help === "string" ? field.validation.help : null);
  const fieldError = (key: string) => errors.find((error) => error.field === key || error.field === `metadata.${key}`);
  const update = (key: string, value: unknown) => { setMetadata((current) => ({ ...current, [key]: value })); setErrors((current) => current.filter((error) => error.field !== key && error.field !== `metadata.${key}`)); };
  const focusField = (field: string | undefined) => {
    if (!field) return;
    fieldRefs.current[field]?.focus();
    if (fieldRefs.current[field]) return;
    document.querySelector<HTMLElement>(`[data-field-key="${CSS.escape(field)}"]`)?.focus();
  };
  const renderField = (field: FormField) => {
    const value = metadata[field.field_key] ?? "";
    const invalid = Boolean(fieldError(field.field_key));
    const common = { "data-field-key": `metadata.${field.field_key}`, required: field.required, "aria-invalid": invalid, className: `min-h-11 rounded-lg border px-3 font-normal ${invalid ? "border-rose-500" : "border-slate-300"}` };
    if (field.data_type === "long_text") return <textarea {...common} rows={3} value={typeof value === "string" ? value : ""} onChange={(event) => update(field.field_key, event.target.value)} />;
    if (field.data_type === "select" || field.data_type === "country" || field.data_type === "department" || field.data_type === "person") return <select {...common} value={typeof value === "string" ? value : ""} onChange={(event) => update(field.field_key, event.target.value)}><option value="">Chọn...</option>{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
    if (field.data_type === "multi_select") return <select {...common} multiple className={`${common.className} min-h-24 py-2`} value={Array.isArray(value) ? value as string[] : []} onChange={(event) => update(field.field_key, Array.from(event.target.selectedOptions, (option) => option.value))}>{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
    if (field.data_type === "date") return <input {...common} type="text" inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10} value={dateInputs[field.field_key] ?? (typeof value === "string" ? formatIsoDateVi(value) : "")} onChange={(event) => { const text = formatViDateInput(event.target.value); setDateInputs((current) => ({ ...current, [field.field_key]: text })); const parsed = parseViDate(text); update(field.field_key, parsed ?? text); }} />;
    const inputType = field.data_type === "datetime" ? "datetime-local" : field.data_type === "number" ? "number" : field.data_type === "url" ? "url" : "text";
    return <input {...common} type={inputType} value={typeof value === "string" || typeof value === "number" ? value : ""} onChange={(event) => update(field.field_key, field.data_type === "number" ? event.target.value === "" ? "" : Number(event.target.value) : event.target.value)} />;
  };
  const selectFiles = (selected: File[]) => {
    const validation = validateSelectedFiles(selected);
    if (validation.length) { setMessage(validation.map((item: { index: number; code: string }) => `Tệp ${selected[item.index]?.name}: ${humanError(item.code)}`).join(" ")); return; }
    setMessage(""); setUploads(selected.map((file) => ({ file, uploadId: crypto.randomUUID(), state: "pending" })));
  };
  const removeFile = (file: File) => setUploads((current) => current.filter((entry) => entry.file !== file));
  const uploadFiles = async (recordId: string, items: UploadItem[]) => {
    const failed: UploadItem[] = [];
    for (const item of items.filter((entry) => entry.state !== "uploaded")) {
      setUploads((current) => current.map((entry) => entry.file === item.file ? { ...entry, state: "uploading" } : entry));
      const result = await uploadRecordFiles(recordId, [{ file: item.file, uploadId: item.uploadId }]);
      if (result.unknown.length) {
        const reconciliation = await reconcileRecordFile(recordId, item.uploadId);
        if (reconciliation.file) { setUploads((current) => current.map((entry) => entry.file === item.file ? { ...entry, state: "uploaded" } : entry)); continue; }
        failed.push({ ...item, state: "failed", code: "upload_result_unknown" }); setUploads((current) => current.map((entry) => entry.file === item.file ? { ...entry, state: "failed", code: "upload_result_unknown" } : entry));
      } else if (result.failed.length) { failed.push({ ...item, state: "failed", code: result.failed[0].code }); setUploads((current) => current.map((entry) => entry.file === item.file ? { ...entry, state: "failed", code: result.failed[0].code } : entry)); }
      else setUploads((current) => current.map((entry) => entry.file === item.file ? { ...entry, state: "uploaded" } : entry));
    }
    setUploads((current) => current.map((entry) => failed.some((item) => item.file === entry.file) ? { ...entry, state: "failed" } : entry));
    return failed;
  };
  const submit = async () => {
    if (busy) return;
    setMessage(""); setErrors([]);
    const clientErrors = validateRecordForm({ mode, categoryId, categoryCode: selectedCategory?.code, languageCode, requiresSubcategory, subcategoryId, recordTypeId, title, metadata, fields, visibility: isDanhBa ? "department" : visibility });
    if (clientErrors.length) { setErrors(clientErrors); focusField(clientErrors[0].field); return; }
    const body = { categoryId: subcategoryId || categoryId, languageCode: languageCode || null, recordTypeId, title, summary, metadata, visibility: isDanhBa ? "department" : visibility };
    setBusy(true);
    if (mode === "create" && createdRecordId) {
      const failed = await uploadFiles(createdRecordId, uploads);
      setBusy(false);
      if (!failed.length) router.push(`/database/records/${createdRecordId}`);
      else setMessage("Một số tệp chưa tải lên được. Bạn có thể bấm thử lại; hồ sơ đã được lưu.");
      return;
    }
    let response: Response;
    let payload: { record?: { id: string }; fields?: FieldError[]; error?: string } | null;
    try {
      response = await fetch(mode === "create" ? "/api/database/records" : `/api/database/records/${initial?.id}`, { method: mode === "create" ? "POST" : "PATCH", headers: { "content-type": "application/json", "Idempotency-Key": clientRequestId.current }, body: JSON.stringify(body) });
      payload = await response.json().catch(() => null) as { record?: { id: string }; fields?: FieldError[]; error?: string } | null;
    } catch {
      setBusy(false); setMessage("Không thể kết nối máy chủ. Vui lòng thử lại."); return;
    }
    if (!response.ok || !payload?.record) { const nextErrors = payload?.fields ?? []; setErrors(nextErrors); setMessage(payload?.error === "record_locked" ? "Hồ sơ đang chờ duyệt, không thể sửa." : payload?.error === "forbidden" ? "Bạn không có quyền thực hiện thao tác này." : nextErrors.length ? "Vui lòng kiểm tra các trường được đánh dấu." : "Không thể lưu hồ sơ. Vui lòng thử lại."); setBusy(false); focusField(nextErrors[0]?.field); return; }
    if (mode === "edit") { setBusy(false); router.push(`/database/records/${initial?.id}`); return; }
    const recordId = payload.record.id;
    setCreatedRecordId(recordId);
    const failed = await uploadFiles(recordId, uploads);
    setBusy(false);
    if (!failed.length) router.push(`/database/records/${recordId}`);
    else setMessage("Một số tệp chưa tải lên được. Bạn có thể bấm thử lại; hồ sơ đã được lưu.");
  };
  return <div ref={formRef} tabIndex={-1}><div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">* Thông tin bắt buộc</div><div className="grid gap-4 md:grid-cols-2">
    {mode === "create" ? <><label className="grid gap-1 text-sm font-semibold">Nhóm hồ sơ <span className="text-rose-600">*</span><select ref={(element) => { fieldRefs.current.categoryId = element; }} className={`min-h-11 rounded-lg border px-3 font-normal ${fieldError("categoryId") ? "border-rose-500" : "border-slate-300"}`} value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setLanguageCode(""); setSubcategoryId(""); setRecordTypeId(""); }}><option value="">Chọn nhóm hồ sơ</option>{selectableCategories(catalog.categories).filter((category) => !category.parent_id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{fieldError("categoryId") ? <span role="alert" className="text-sm font-normal text-rose-700">Vui lòng chọn nhóm hồ sơ.</span> : null}</label>{requiresSubcategory ? <label className="grid gap-1 text-sm font-semibold">Nhóm con <span className="text-rose-600">*</span><select ref={(element) => { fieldRefs.current.subcategoryId = element; }} className={`min-h-11 rounded-lg border px-3 font-normal ${fieldError("subcategoryId") ? "border-rose-500" : "border-slate-300"}`} value={subcategoryId} onChange={(event) => { setSubcategoryId(event.target.value); setRecordTypeId(""); setErrors((current) => current.filter((error) => error.field !== "subcategoryId" && error.field !== "recordTypeId")); }}><option value="">Chọn nhóm con</option>{subcategories.map((category: Catalog["categories"][number]) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{fieldError("subcategoryId") ? <span role="alert" className="text-sm font-normal text-rose-700">Vui lòng chọn nhóm con.</span> : null}</label> : null}{selectedCategory?.code === CONTENT_ROOT_CODE ? <label className="grid gap-1 text-sm font-semibold">Tổ ngôn ngữ <span className="text-rose-600">*</span><select ref={(element) => { fieldRefs.current.languageCode = element; }} className={`min-h-11 rounded-lg border px-3 font-normal ${fieldError("languageCode") ? "border-rose-500" : "border-slate-300"}`} value={languageCode} onChange={(event) => { setLanguageCode(event.target.value); setRecordTypeId(""); setErrors((current) => current.filter((error) => error.field !== "languageCode")); }}><option value="">Chọn tổ ngôn ngữ</option>{LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{fieldError("languageCode") ? <span role="alert" className="text-sm font-normal text-rose-700">Vui lòng chọn tổ ngôn ngữ.</span> : null}</label> : null}<label className="grid gap-1 text-sm font-semibold">Loại hồ sơ <span className="text-rose-600">*</span><select ref={(element) => { fieldRefs.current.recordTypeId = element; }} disabled={selectedCategory?.code === CONTENT_ROOT_CODE && !languageCode} className={`min-h-11 rounded-lg border px-3 font-normal ${fieldError("recordTypeId") ? "border-rose-500" : "border-slate-300"}`} value={recordTypeId} onChange={(event) => setRecordTypeId(event.target.value)}><option value="">Chọn loại hồ sơ</option>{types.map((type: Catalog["recordTypes"][number]) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>{fieldError("recordTypeId") ? <span role="alert" className="text-sm font-normal text-rose-700">Vui lòng chọn loại hồ sơ.</span> : null}</label></> : <label className="grid gap-1 text-sm font-semibold">Mã hồ sơ<input readOnly value={initial?.recordCode ?? ""} className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm" /></label>}
    <label className="grid gap-1 text-sm font-semibold">{titleField?.label ?? "Tên / trích yếu"} <span className="text-rose-600">*</span><input ref={(element) => { fieldRefs.current.title = element; }} className={`min-h-11 rounded-lg border px-3 font-normal ${fieldError("title") ? "border-rose-500" : "border-slate-300"}`} value={title} onChange={(event) => { setTitle(event.target.value); setErrors((current) => current.filter((error) => error.field !== "title")); }} />{fieldHelp(titleField) ? <span className="text-xs font-normal text-slate-500">{fieldHelp(titleField)}</span> : null}{fieldError("title") ? <span role="alert" className="text-sm font-normal text-rose-700">{humanError(fieldError("title")!.code)}</span> : null}</label>{summaryField?.hidden ? null : <label className="grid gap-1 text-sm font-semibold md:col-span-2">{summaryField?.label ?? "Mô tả"}<textarea className="rounded-lg border border-slate-300 px-3 py-2 font-normal" rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} />{fieldHelp(summaryField) ? <span className="text-xs font-normal text-slate-500">{fieldHelp(summaryField)}</span> : null}</label>}
    <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2"><input type="checkbox" disabled={isDanhBa} checked={!isDanhBa && visibility === "public"} onChange={(event) => setVisibility(event.target.checked ? "public" : "department")} /> Tài liệu chung trong nội bộ Tạp chí (mọi người trong cơ quan xem được sau khi duyệt){isDanhBa ? <span className="text-xs font-normal text-slate-500">Danh bạ chỉ dùng trong phòng.</span> : null}</label>
    {fields.filter((field) => !field.hidden && !["record_code", "title", "summary", "status"].includes(field.field_key)).map((field) => <label key={field.field_key} className="grid gap-1 text-sm font-semibold">{field.label}{field.required ? <span className="text-rose-600"> *</span> : null}{renderField(field)}{fieldHelp(field) ? <span className="text-xs font-normal text-slate-500">{fieldHelp(field)}</span> : null}{fieldError(field.field_key) ? <span role="alert" className="text-sm font-normal text-rose-700">{field.data_type === "date" && fieldError(field.field_key)!.code === "invalid_type" ? "Ngày không hợp lệ, nhập theo dạng dd/mm/yyyy" : humanError(fieldError(field.field_key)!.code)}</span> : null}</label>)}
  </div>{mode === "create" ? <section className={`mt-6 rounded-xl border-2 border-dashed p-5 ${dragActive ? "border-orange-600 bg-orange-100" : "border-orange-300 bg-orange-50/50"}`} onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); setDragActive(false); selectFiles(Array.from(event.dataTransfer.files)); }}><h2 className="text-lg font-bold">Tài liệu đính kèm</h2><p className="mt-1 text-sm text-slate-600">Kéo thả tài liệu vào đây hoặc chọn từ máy tính.</p><p className="mt-1 text-xs text-slate-500">Hỗ trợ PDF, Word, Excel - Tối đa 50 MB mỗi tệp.</p><p className="mt-2 text-sm font-semibold text-slate-700">Tổng số tệp: {uploads.length}</p><label className="mt-4 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-orange-700 px-5 text-sm font-bold text-white"><span>Chọn tệp đính kèm</span><input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx" className="sr-only" onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} /></label>{uploads.length ? <ul className="mt-4 space-y-2">{uploads.map((item) => <li key={`${item.file.name}-${item.file.lastModified}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm"><span>{item.file.name} · {formatBytes(item.file.size)}</span><span className={item.state === "failed" ? "text-rose-700" : "text-slate-600"}>{item.state === "pending" ? "Chờ tải lên" : item.state === "uploading" ? "Đang tải lên" : item.state === "uploaded" ? "Đã tải lên" : `Tải lên thất bại: ${humanError(item.code ?? "")}`}</span><button type="button" className="text-sm font-semibold text-rose-700" onClick={() => removeFile(item.file)}>Xóa tệp</button></li>)}</ul> : null}</section> : null}{message ? <p role="alert" className="mt-4 text-sm text-rose-700">{message}</p> : null}{createdRecordId && mode === "create" && uploads.some((item) => item.state === "failed") ? <button type="button" className="mt-3 text-sm font-semibold text-orange-700" onClick={() => router.push(`/database/records/${createdRecordId}`)}>Xem hồ sơ đã lưu</button> : null}<div className="mt-5 flex gap-2"><button type="button" disabled={busy} onClick={() => void submit()} className="min-h-11 rounded-lg bg-orange-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang xử lý..." : mode === "create" ? createdRecordId ? "Thử lại tệp lỗi" : "Lưu hồ sơ" : "Lưu thay đổi"}</button>{mode === "edit" ? <button type="button" disabled={busy} onClick={() => router.push(`/database/records/${initial?.id}`)} className="min-h-11 rounded-lg border border-slate-300 px-5 text-sm font-semibold">Hủy</button> : null}</div></div>;
}
