"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import type { JournalismStructureDepartment, JournalismStructurePageData, JournalismStructureSeries, JournalismStructureTopic } from "@/lib/journalismStructureRepository";

const inactive = (active: boolean) => active ? null : <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">Ngừng sử dụng</span>;

function StructureForm({ kind, scope, departments, topics, initial, onDone }: {
  kind: "topic" | "series";
  scope: "all" | "department";
  departments: JournalismStructureDepartment[];
  topics: JournalismStructureTopic[];
  initial?: JournalismStructureTopic | JournalismStructureSeries;
  onDone: () => void;
}) {
  const { notify } = useActionFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const series = kind === "series";
  const initialSeries = initial && "topic_id" in initial ? initial : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [departmentId, setDepartmentId] = useState(initial?.department_id ?? (scope === "department" ? departments[0]?.id ?? "" : ""));
  const [topicId, setTopicId] = useState(initialSeries?.topic_id ?? "");
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const editing = Boolean(initial);
      const path = editing ? `/api/journalism/${series ? "series" : "topics"}/${initial?.id}` : `/api/journalism/${series ? "series" : "topics"}`;
      const body = editing
        ? (series ? { name, description, topicId: topicId || null } : { name, description })
        : (series ? { name, description, departmentId: departmentId || null, topicId: topicId || null } : { name, description, departmentId: departmentId || null });
      const response = await fetch(path, { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể lưu cấu trúc báo chí."));
      notify("success", editing ? "Đã lưu thay đổi." : "Đã tạo cấu trúc mới."); onDone();
    } catch (caught) { const message = errorMessage(caught, "Không thể lưu cấu trúc báo chí."); setError(message); notify("error", message); }
    finally { setBusy(false); }
  };
  const compatibleTopics = topics.filter((topic) => topic.is_active && (topic.department_id === null || topic.department_id === departmentId));
  return <div className="grid gap-3 rounded-xl border bg-slate-50 p-3 sm:grid-cols-2">
    <label className="grid gap-1 text-sm font-semibold">Tên {series ? "loạt bài" : "chủ đề"} *<input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required className="rounded-lg border bg-white px-3 py-2 font-normal" /></label>
    <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Mô tả<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} className="min-h-20 rounded-lg border bg-white px-3 py-2 font-normal" /></label>
    {!initial ? <label className="grid gap-1 text-sm font-semibold">Phạm vi<select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} disabled={scope === "department"} className="rounded-lg border bg-white px-3 py-2 font-normal"><option value="">Toàn tòa soạn</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label> : null}
    {series ? <label className="grid gap-1 text-sm font-semibold">Chủ đề cha (tùy chọn)<select value={topicId} onChange={(event) => setTopicId(event.target.value)} className="rounded-lg border bg-white px-3 py-2 font-normal"><option value="">Không chọn</option>{compatibleTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label> : null}
    {error ? <p role="alert" className="sm:col-span-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
    <div className="flex gap-2 sm:col-span-2"><button type="button" disabled={busy || !name.trim()} onClick={submit} className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Đang lưu…" : "Lưu"}</button><button type="button" onClick={onDone} className="rounded-lg border bg-white px-4 py-2 font-semibold">Hủy</button></div>
  </div>;
}

function StructureCard({ kind, row, scope, departments, topics, onRefresh }: { kind: "topic" | "series"; row: JournalismStructureTopic | JournalismStructureSeries; scope: "all" | "department"; departments: JournalismStructureDepartment[]; topics: JournalismStructureTopic[]; onRefresh: () => void }) {
  const router = useRouter();
  const { notify } = useActionFeedback();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const series = kind === "series";
  const topicName = series && "topic_id" in row ? topics.find((topic) => topic.id === row.topic_id)?.name : null;
  const archive = async () => {
    if (!window.confirm(`Lưu trữ ${series ? "loạt bài" : "chủ đề"} này? Các liên kết hiện có vẫn được giữ để xem lịch sử.`)) return;
    setBusy(true);
    try { const response = await fetch(`/api/journalism/${series ? "series" : "topics"}/${row.id}/archive`, { method: "POST" }); if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể lưu trữ.")); notify("success", "Đã lưu trữ."); onRefresh(); } catch (error) { notify("error", errorMessage(error, "Không thể lưu trữ.")); } finally { setBusy(false); }
  };
  if (editing) return <StructureForm kind={kind} scope={scope} departments={departments} topics={topics} initial={row} onDone={() => { setEditing(false); router.refresh(); }} />;
  return <article className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-bold">{row.name}{inactive(row.is_active)}</h3><p className="mt-1 text-sm text-slate-600">{row.department_id ? departments.find((department) => department.id === row.department_id)?.name ?? "Phòng ban" : "Toàn tòa soạn"}</p>{series && topicName ? <p className="mt-1 text-sm text-slate-600">Chủ đề cha: {topicName}</p> : null}{row.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{row.description}</p> : null}</div><div className="flex shrink-0 flex-wrap gap-2">{row.is_active ? <><button type="button" onClick={() => setEditing(true)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Chỉnh sửa</button><button type="button" disabled={busy} onClick={archive} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Lưu trữ</button></> : <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">Chỉ đọc lịch sử</span>}{series ? <Link href={`/journalism/structures/${row.id}`} className="rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-800">Mở thứ tự</Link> : null}</div></div></article>;
}

export default function JournalismStructuresShell({ data, userLabel }: { data: JournalismStructurePageData; userLabel: string }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [tab, setTab] = useState<"topics" | "series">("topics");
  const [creating, setCreating] = useState(false);
  const rows = tab === "topics" ? data.topics : data.series;
  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 lg:flex-row lg:gap-4"><AppNav currentPath="/journalism/structures" userLabel={userLabel} onLogout={() => { void logout().then(() => router.replace("/login")); }} /><main className="min-w-0 flex-1"><header className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Báo chí</p><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold sm:text-3xl">Chủ đề &amp; Loạt bài</h1><p className="mt-1 text-sm text-slate-600">Quản lý cấu trúc theo phạm vi được cấp quyền. Dữ liệu ngừng sử dụng vẫn hiển thị để bảo toàn lịch sử.</p></div><button type="button" onClick={() => setCreating((value) => !value)} className="rounded-lg bg-orange-600 px-4 py-2.5 font-semibold text-white">{creating ? "Đóng biểu mẫu" : `+ Tạo ${tab === "topics" ? "chủ đề" : "loạt bài"}`}</button></div></header><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { setTab("topics"); setCreating(false); }} className={`rounded-full border px-4 py-2 font-semibold ${tab === "topics" ? "border-orange-500 bg-orange-500 text-white" : "bg-white"}`}>Chủ đề ({data.topics.length})</button><button type="button" onClick={() => { setTab("series"); setCreating(false); }} className={`rounded-full border px-4 py-2 font-semibold ${tab === "series" ? "border-orange-500 bg-orange-500 text-white" : "bg-white"}`}>Loạt bài ({data.series.length})</button></div>{creating ? <div className="mt-3"><StructureForm kind={tab === "topics" ? "topic" : "series"} scope={data.scope} departments={data.departments} topics={data.topics} onDone={() => { setCreating(false); router.refresh(); }} /></div> : null}<section className="mt-3 space-y-3">{rows.length ? rows.map((row) => <StructureCard key={row.id} kind={tab === "topics" ? "topic" : "series"} row={row} scope={data.scope} departments={data.departments} topics={data.topics} onRefresh={() => router.refresh()} />) : <div className="rounded-xl border bg-white p-8 text-center text-slate-600">Chưa có dữ liệu trong phạm vi được cấp quyền.</div>}</section></main></div></div>;
}
