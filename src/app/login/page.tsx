"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("quangthien");
  const [password, setPassword] = useState("123456");
  const [message, setMessage] = useState("Dùng username (không dấu, viết liền) hoặc email.");

  const submit = async () => {
    const res = await login(identifier.trim(), password);
    if (!res.ok) return setMessage(`❌ ${res.error}`);
    setMessage("✅ Đăng nhập thành công.");
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:p-6">
      <div className="mx-auto mt-6 w-full max-w-md rounded-xl border bg-white p-4 sm:mt-16 sm:p-6">
        <h1 className="text-xl font-bold sm:text-2xl">Đăng nhập hệ thống</h1>
        <div className="mt-4 space-y-3">
          <input
            className="w-full rounded border px-3 py-3 text-base"
            placeholder="Tài khoản (vd: quangthien)"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <input
            type="password"
            className="w-full rounded border px-3 py-3 text-base"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={submit} className="w-full rounded bg-slate-900 px-4 py-3 text-base font-semibold text-white">
            Đăng nhập
          </button>
          <p className="text-sm text-slate-600">{message}</p>
        </div>
      </div>
    </main>
  );
}
