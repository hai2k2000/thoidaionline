"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const submit = async () => {
    if (password !== confirm) return setMessage("Mật khẩu nhập lại không khớp.");
    const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    setMessage(response.ok ? "Đã đổi mật khẩu. Bạn có thể đăng nhập." : (payload?.error || "Không thể đổi mật khẩu."));
  };
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-md rounded-xl border bg-white p-6"><h1 className="text-2xl font-bold">Đặt mật khẩu mới</h1><input type="password" minLength={10} className="mt-4 w-full rounded border px-3 py-3" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu mới (ít nhất 10 ký tự)" /><input type="password" minLength={10} className="mt-3 w-full rounded border px-3 py-3" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Nhập lại mật khẩu" /><button className="mt-3 w-full rounded bg-slate-900 px-4 py-3 font-semibold text-white" onClick={submit}>Đổi mật khẩu</button>{message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}<Link className="mt-4 inline-block text-sm text-blue-700 underline" href="/login">Đăng nhập</Link></div></main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-50 p-8">Đang tải...</main>}><ResetPasswordForm /></Suspense>;
}
