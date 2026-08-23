"use client";

import Link from "next/link";
import { useState } from "react";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

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
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-md rounded-xl border bg-white p-6"><h1 className="text-2xl font-bold">Quên mật khẩu</h1><p className="mt-2 text-sm text-slate-600">Nhập tên đăng nhập hoặc thư điện tử đã đăng ký.</p><input disabled={busy} className="mt-4 w-full rounded border px-3 py-3" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Tên đăng nhập hoặc thư điện tử" /><button disabled={busy} className="mt-3 w-full rounded bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50" onClick={submit}>{busy ? "Đang gửi..." : "Gửi hướng dẫn"}</button>{message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}<Link className="mt-4 inline-block text-sm text-blue-700 underline" href="/login">Quay lại đăng nhập</Link></div></main>;
}
