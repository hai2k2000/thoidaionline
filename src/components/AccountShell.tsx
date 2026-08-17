"use client";

import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";

export default function AccountShell({ userLabel, roleName, email }: { userLabel: string; roleName: string; email: string | null }) {
  const router = useRouter();
  const { logout } = useAuth();
  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6"><div className="flex w-full flex-col gap-4 lg:flex-row"><AppNav currentPath="/account" userLabel={userLabel} onLogout={() => { logout(); router.replace("/login"); }} /><main className="min-w-0 flex-1"><section className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Tài khoản</p><h1 className="mt-2 text-2xl font-bold">{userLabel}</h1><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Vai trò</dt><dd className="font-semibold">{roleName}</dd></div><div><dt className="text-slate-500">Email</dt><dd className="font-semibold">{email ?? "Chưa cập nhật"}</dd></div></dl><p className="mt-4 text-sm text-slate-600">Công việc, đánh giá và bằng chứng được truy cập qua các API server có kiểm tra phiên đăng nhập.</p></section></main></div></div>;
}
