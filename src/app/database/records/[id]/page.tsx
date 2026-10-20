"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppNav from "@/components/AppNav";
import DatabaseRecordForm from "@/components/DatabaseRecordForm";

type FormField = { field_key: string; label: string; data_type: string; required: boolean; options?: Array<{ value: string; label: string }> };
type Catalog = { forms: Array<{ record_type_id: string; db_form_fields?: FormField[] }>; categories: Array<{ id: string; name: string }>; recordTypes: Array<{ id: string; category_id: string; name: string }> };
type DetailRecord = { id: string; category_id: string; record_type_id: string; record_code: string; title: string; summary: string | null; status: string; metadata: Record<string, unknown> };
type Detail = { record: DetailRecord; files: Array<{ id: string; original_name: string; mime_type: string; size_bytes: number; sha256: string }>; externalLinks: Array<{ id: string; provider: string; url: string }>; keywords: string[]; history: Array<{ id: string; action: string; created_at: string }> };

const statusLabels: Record<string, string> = { draft: "Nháp", pending_review: "Chờ duyệt", approved: "Đã duyệt", archived: "Lưu trữ", deleted: "Đã xóa" };
const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const formatValue = (value: unknown, field?: FormField) => {
  if (value === null || value === undefined || value === "") return "Chưa cập nhật";
  const labels = new Map((field?.options ?? []).map((option) => [option.value, option.label]));
  if (Array.isArray(value)) return value.map((item) => labels.get(String(item)) ?? String(item)).join(", ");
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (field?.data_type === "date") { const date = new Date(`${String(value)}T00:00:00`); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("vi-VN"); }
  if (field?.data_type === "datetime") { const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("vi-VN"); }
  return labels.get(String(value)) ?? String(value);
};

export default function DatabaseRecordDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loading, user, logout, hasPermission } = useAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [message, setMessage] = useState("Đang tải...");
  const [editing, setEditing] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);

  const load = useCallback(async () => {
    const [recordResponse, catalogResponse] = await Promise.all([
      fetch(`/api/database/records/${params.id}`, { cache: "no-store" }),
      fetch("/api/database/catalog", { cache: "no-store" }),
    ]);
    const payload = await recordResponse.json() as { record?: Detail; error?: string };
    if (!recordResponse.ok || !payload.record) throw new Error(payload.error ?? "Không thể tải hồ sơ.");
    setDetail(payload.record);
    if (catalogResponse.ok) setCatalog(await catalogResponse.json() as Catalog);
    setMessage("");
  }, [params.id]);

  useEffect(() => {
    if (loading || !user) return;
    const task = window.setTimeout(() => { void load().catch((error) => setMessage(error.message)); }, 0);
    return () => window.clearTimeout(task);
  }, [loading, user, load]);

  const formFields = useMemo(() => catalog?.forms.find((form) => form.record_type_id === detail?.record.record_type_id)?.db_form_fields ?? [], [catalog, detail]);
  const fieldLabels = useMemo(() => new Map(formFields.map((field) => [field.field_key, field.label])), [formFields]);
  const upload = async (file: File) => {
    setUploadBusy(true);
    const body = new FormData(); body.set("file", file);
    const response = await fetch(`/api/database/records/${params.id}/files`, { method: "POST", body });
    setUploadBusy(false);
    if (!response.ok) { setMessage("Không thể tải tệp lên. Vui lòng kiểm tra định dạng và dung lượng."); return; }
    await load();
  };

  if (loading || !user) return <main className="grid min-h-screen place-items-center bg-slate-50">Đang tải...</main>;
  if (!detail) return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600">{message}</main>;
  const initial = { id: detail.record.id, categoryId: detail.record.category_id, recordTypeId: detail.record.record_type_id, recordCode: detail.record.record_code, title: detail.record.title, summary: detail.record.summary, metadata: detail.record.metadata };

  return <main className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4"><div className="mb-4 lg:mb-0"><AppNav currentPath="/database/records" userLabel={`${user.full_name} (${user.role_name})`} onLogout={logout} /></div><div><button type="button" onClick={() => router.push("/database/records")} className="mb-4 text-sm font-semibold text-orange-700">← Quay lại danh sách</button><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    {message ? <p role="alert" className="mb-4 text-sm text-rose-700">{message}</p> : null}
    {editing ? <DatabaseRecordForm mode="edit" catalog={catalog ?? { categories: [], recordTypes: [], forms: [] }} initial={initial} /> : <>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-slate-500">{detail.record.record_code}</p><h1 className="mt-1 text-2xl font-bold">{detail.record.title}</h1></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{statusLabels[detail.record.status] ?? detail.record.status}</span></div>
      {detail.record.summary ? <p className="mt-5 whitespace-pre-wrap text-slate-700">{detail.record.summary}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">{hasPermission("record.edit") ? <button type="button" disabled={!catalog} className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => setEditing(true)}>Sửa hồ sơ</button> : null}<a className="rounded border px-3 py-2 text-sm font-semibold" href={`/api/database/records/${params.id}/export`}>Xuất metadata</a></div>
      <h2 className="mt-6 border-b pb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Thông tin hồ sơ</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(detail.record.metadata).map(([key, value]) => { const field = formFields.find((item) => item.field_key === key); return <div key={key} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-500">{fieldLabels.get(key) ?? key}</dt><dd className="mt-1 break-words text-sm">{formatValue(value, field)}</dd></div>; })}</dl>
      <section className="mt-6"><h2 className="border-b pb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Tệp đính kèm</h2><label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold"><span>{uploadBusy ? "Đang tải lên..." : "Thêm tệp"}</span><input disabled={uploadBusy} className="sr-only" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label>{detail.files.length ? <ul className="mt-3 space-y-2">{detail.files.map((file) => <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 p-3 text-sm"><span>{file.original_name} · {formatBytes(file.size_bytes)}</span><a className="font-semibold text-orange-700" href={`/api/database/records/${params.id}/files/${file.id}`}>Tải xuống</a></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">Chưa có tệp.</p>}</section>
      <section className="mt-6"><h2 className="border-b pb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Từ khóa và liên kết</h2><p className="mt-3 text-sm">{detail.keywords.length ? detail.keywords.join(", ") : "Chưa có từ khóa."}</p>{detail.externalLinks.map((link) => <a className="mt-2 block text-sm text-orange-700" href={link.url} key={link.id} target="_blank" rel="noreferrer">{link.provider}: {link.url}</a>)}</section>
      <section className="mt-6"><h2 className="border-b pb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Lịch sử</h2><ul className="mt-3 space-y-2 text-sm">{detail.history.map((item) => <li key={item.id}>{item.action} · {new Date(item.created_at).toLocaleString("vi-VN")}</li>)}</ul></section>
    </>}
  </section></div></div></main>;
}
