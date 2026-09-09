"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getPasswordPolicyError, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, PASSWORD_POLICY_HINT } from "@/lib/passwordPolicy";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import PasswordInput from "@/components/PasswordInput";
import AuthShell from "@/components/AuthShell";

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
  return <AuthShell title="Đặt mật khẩu mới" description="Tạo mật khẩu mới cho tài khoản của bạn." footer={<Link className="inline-flex min-h-11 items-center text-sm font-semibold text-orange-700 underline decoration-orange-300 underline-offset-4 hover:text-orange-900" href="/login">Quay lại đăng nhập</Link>}><form className="flex flex-col gap-5" onSubmit={(event) => { event.preventDefault(); void submit(); }}><label htmlFor="new-password" className="grid gap-2 text-sm font-semibold text-slate-800">Mật khẩu mới<PasswordInput id="new-password" disabled={busy} minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu mới" className="min-h-12 w-full rounded-none border border-slate-300 px-3 py-3 text-base font-normal" /></label><label htmlFor="confirm-password" className="grid gap-2 text-sm font-semibold text-slate-800">Nhập lại mật khẩu<PasswordInput id="confirm-password" disabled={busy} minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Nhập lại mật khẩu mới" className="min-h-12 w-full rounded-none border border-slate-300 px-3 py-3 text-base font-normal" /></label><p className="text-xs leading-5 text-slate-500">{PASSWORD_POLICY_HINT}</p><button type="submit" disabled={busy} className="min-h-12 w-full rounded-none bg-orange-600 px-4 py-3 font-semibold text-white hover:bg-orange-700 disabled:opacity-50">{busy ? "Đang cập nhật..." : "Đổi mật khẩu"}</button></form>{message ? <p role="status" aria-live="polite" className="mt-4 text-sm leading-6 text-slate-600">{message}</p> : null}</AuthShell>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-50 p-8">Đang tải...</main>}><ResetPasswordForm /></Suspense>;
}
