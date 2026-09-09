"use client";

import Link from "next/link";
import { useState } from "react";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import AuthShell from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { notify } = useActionFeedback();
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier }) });
      if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể gửi hướng dẫn."));
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      const success = payload?.message || "Nếu thông tin phù hợp, hướng dẫn đặt lại mật khẩu sẽ được gửi tới email đã đăng ký."; setMessage(success); notify("success", success);
    } catch (error) { const text = errorMessage(error, "Lỗi kết nối. Vui lòng thử lại."); setMessage(text); notify("error", text); }
    finally { setBusy(false); }
  };
  return <AuthShell title="Quên mật khẩu" description="Nhập tên đăng nhập hoặc thư điện tử đã đăng ký để nhận hướng dẫn đặt lại mật khẩu." footer={<Link className="inline-flex min-h-11 items-center text-sm font-semibold text-orange-700 underline decoration-orange-300 underline-offset-4 hover:text-orange-900" href="/login">Quay lại đăng nhập</Link>}><form className="flex flex-col gap-5" onSubmit={(event) => { event.preventDefault(); void submit(); }}><label htmlFor="forgot-identifier" className="grid gap-2 text-sm font-semibold text-slate-800">Tên đăng nhập hoặc thư điện tử<input id="forgot-identifier" name="identifier" autoComplete="username" disabled={busy} className="min-h-12 w-full rounded-none border border-slate-300 px-3 py-3 text-base font-normal" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Nhập thông tin tài khoản" /></label><button type="submit" disabled={busy} className="min-h-12 w-full rounded-none bg-orange-600 px-4 py-3 font-semibold text-white hover:bg-orange-700 disabled:opacity-50">{busy ? "Đang gửi..." : "Gửi hướng dẫn"}</button></form>{message ? <p role="status" aria-live="polite" className="mt-4 text-sm leading-6 text-slate-600">{message}</p> : null}</AuthShell>;
}
