"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppNav from "@/components/AppNav";

export default function DatabaseSearchPage() {
  const router = useRouter(); const { loading, user, logout, hasPermission } = useAuth(); const [q, setQ] = useState(""); const [status, setStatus] = useState("");
  if (loading || !user) return <main className="grid min-h-screen place-items-center bg-slate-50">Đang tải...</main>;
  return <main className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4"><div className="mb-4 lg:mb-0"><AppNav currentPath="/database/search" userLabel={`${user.full_name} (${user.role_name})`} onLogout={logout} /></div><div><header className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">Cơ sở dữ liệu</p><h1 className="mt-1 text-2xl font-bold">Tìm kiếm nâng cao</h1></header><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">Tìm kiếm luôn áp dụng ACL ở server trước khi trả kết quả.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Từ khóa<input className="min-h-11 rounded-lg border px-3 font-normal" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Mã, tên, trích yếu" /></label><label className="grid gap-1 text-sm font-semibold">Trạng thái<select className="min-h-11 rounded-lg border px-3 font-normal" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả</option><option value="draft">Nháp</option><option value="pending_review">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="archived">Lưu trữ</option></select></label></div><button type="button" onClick={() => router.push(`/database/records?q=${encodeURIComponent(q)}${status ? `&status=${encodeURIComponent(status)}` : ""}`)} className="mt-5 min-h-11 rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white">Áp dụng bộ lọc</button></section></div></div></main>;
}
