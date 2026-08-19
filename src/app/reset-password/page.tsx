"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getPasswordPolicyError, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, PASSWORD_POLICY_HINT } from "@/lib/passwordPolicy";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import PasswordInput from "@/components/PasswordInput";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { notify } = useActionFeedback();
  const submit = async () => {
    if (busy) return;
    if (password !== confirm) { notify("error", "Mật khẩu nhập lại không khớp."); return setMessage("Mật khẩu nhập lại không khớp."); }
    const policyError = getPasswordPolicyError(password);
    if (policyError) { notify("error", policyError); return setMessage(policyError); }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
      if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể đổi mật khẩu."));
      const success = "Đã đổi mật khẩu. Bạn có thể đăng nhập."; setMessage(success); notify("success", success);
    } catch (error) { const text = errorMessage(error, "Lỗi kết nối. Vui lòng thử lại."); setMessage(text); notify("error", text); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-md rounded-xl border bg-white p-6"><h1 className="text-2xl font-bold">Đặt mật khẩu mới</h1><div className="mt-4"><PasswordInput disabled={busy} minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu mới" /></div><div className="mt-3"><PasswordInput disabled={busy} minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Nhập lại mật khẩu" /></div><p className="mt-2 text-xs text-slate-500">{PASSWORD_POLICY_HINT}</p><button disabled={busy} className="mt-3 w-full rounded bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50" onClick={submit}>{busy ? "Đang cập nhật..." : "Đổi mật khẩu"}</button>{message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}<Link className="mt-4 inline-block text-sm text-blue-700 underline" href="/login">Đăng nhập</Link></div></main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-50 p-8">Đang tải...</main>}><ResetPasswordForm /></Suspense>;
}
