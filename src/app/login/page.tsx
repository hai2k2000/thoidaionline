"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Dùng username, email hoặc số điện thoại.");

  const submit = async () => {
    try {
      const res = await login(identifier.trim(), password);
      if (!res.ok) return setMessage(`❌ ${res.error}`);
      setMessage("✅ Đăng nhập thành công.");
      router.replace("/tasks");
    } catch {
      setMessage("❌ Không kết nối được dữ liệu đăng nhập. Vui lòng thử lại.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:p-6">
      <div className="mx-auto mt-6 w-full max-w-md rounded-xl border bg-white p-4 sm:mt-16 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <img src="/thoidai-logo.png" alt="Báo Thời Đại" className="h-14 w-auto object-contain" />
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Thời Đại Work</h1>
            <p className="text-xs text-slate-500">Hệ thống quản lý công việc nội bộ</p>
          </div>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="mt-4 space-y-3">
          <input
            className="w-full rounded border px-3 py-3 text-base"
            placeholder="Tên đăng nhập, thư điện tử hoặc số điện thoại"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <PasswordInput
            className="w-full rounded border px-3 py-3 text-base"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="w-full rounded bg-slate-900 px-4 py-3 text-base font-semibold text-white">
            Đăng nhập
          </button>
          <Link className="block text-center text-sm text-blue-700 underline" href="/forgot-password">Quên mật khẩu?</Link>
          <p className="text-sm text-slate-600">{message}</p>
        </form>
      </div>
    </main>
  );
}
