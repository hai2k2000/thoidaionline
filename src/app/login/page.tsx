"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("123456");
  const [message, setMessage] = useState("Đăng nhập bằng tài khoản nội bộ DiDiTravel.");

  const submit = async () => {
    const res = await login(identifier.trim(), password);
    if (!res.ok) return setMessage(`❌ ${res.error}`);
    setMessage("✅ Đăng nhập thành công.");
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:p-6">
      <div className="mx-auto mt-6 w-full max-w-md rounded-xl border bg-white p-4 shadow-sm sm:mt-12 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <img src="/diditravel-logo.png" alt="DiDiTravel" className="h-12 w-12 rounded-full border border-red-100 object-cover" />
          <div>
            <h1 className="text-xl font-bold text-red-700 sm:text-2xl">DiDiTravel Task Manager</h1>
            <p className="text-xs text-slate-500">Giải pháp giao việc nội bộ</p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            className="w-full rounded border px-3 py-3 text-base"
            placeholder="Tài khoản (vd: admin)"
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
          <button onClick={submit} className="w-full rounded bg-red-600 px-4 py-3 text-base font-semibold text-white hover:bg-red-700">
            Đăng nhập
          </button>
          <p className="text-sm text-slate-600">{message}</p>
          <p className="text-xs text-slate-500">Tài khoản mẫu: admin / ceo / coo / ketoantruong</p>
        </div>
      </div>
    </main>
  );
}
