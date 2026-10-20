"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";

type RecordRow = { id: string; record_code: string; title: string; summary: string | null; status: string; updated_at: string };
const statusLabels: Record<string, string> = { draft: "Nháp", pending_review: "Chờ duyệt", approved: "Đã duyệt", archived: "Lưu trữ", deleted: "Đã xóa" };

export default function DatabaseRecordsPage() {
  const router = useRouter();
  const { loading, user, logout, hasPermission } = useAuth();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [message, setMessage] = useState("Đang tải hồ sơ...");
  const load = useCallback(async (value = query) => {
    const response = await fetch(`/api/database/records?q=${encodeURIComponent(value)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { records?: RecordRow[]; error?: string } | null;
    if (!response.ok) return setMessage(payload?.error ?? "Không thể tải hồ sơ.");
    setRows(payload?.records ?? []); setMessage("");
  }, [query]);
  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (!hasPermission("record.discover")) { router.push("/"); return; }
    const timer = setTimeout(() => void load(""), 0);
    return () => clearTimeout(timer);
  }, [loading, user, hasPermission, router, load]);
  if (loading || !user) return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600">Đang tải...</main>;
  return <main className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4"><div className="mb-4 lg:mb-0"><AppNav currentPath="/database/records" userLabel={`${user.full_name} (${user.role_name})`} onLogout={logout} /></div><div><header className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">Cơ sở dữ liệu</p><h1 className="mt-1 text-2xl font-bold">Danh sách hồ sơ</h1></div>{hasPermission("record.create") ? <Link href="/database/records/new" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white">+ Tạo hồ sơ</Link> : null}</header><section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void load(); }}><input aria-label="Tìm hồ sơ" className="min-h-11 min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3" placeholder="Tìm mã, tên, trích yếu..." value={query} onChange={(event) => setQuery(event.target.value)} /><button className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Tìm kiếm</button><Link href="/database/search" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold">Tìm nâng cao</Link></form>{message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Mã hồ sơ</th><th className="px-3 py-3">Tên / trích yếu</th><th className="px-3 py-3">Trạng thái</th><th className="px-3 py-3">Cập nhật</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="cursor-pointer hover:bg-orange-50" onClick={() => router.push(`/database/records/${row.id}`)}><td className="px-3 py-3 font-mono text-xs">{row.record_code}</td><td className="px-3 py-3"><p className="font-semibold">{row.title}</p>{row.summary ? <p className="mt-1 line-clamp-1 text-xs text-slate-500">{row.summary}</p> : null}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{statusLabels[row.status] ?? row.status}</span></td><td className="px-3 py-3 text-xs text-slate-500">{new Date(row.updated_at).toLocaleString("vi-VN")}</td></tr>)}{rows.length === 0 ? <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-500">Không có hồ sơ trong phạm vi được phép.</td></tr> : null}</tbody></table></div>}</section></div></div></main>;
}

