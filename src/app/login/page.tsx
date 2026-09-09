"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";
import AuthShell from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Dùng username, email hoặc số điện thoại.");

  const submit = async () => {
    try {
      const res = await login(identifier.trim(), password);
      if (!res.ok) return setMessage(`Đăng nhập không thành công: ${res.error}`);
      setMessage("Đăng nhập thành công.");
      router.replace("/tasks");
    } catch {
      setMessage("Không kết nối được dữ liệu đăng nhập. Vui lòng thử lại.");
    }
  };

  return (
    <AuthShell
      title="Đăng nhập"
      description="Sử dụng tên đăng nhập, thư điện tử hoặc số điện thoại đã đăng ký."
      footer={<Link className="inline-flex min-h-11 items-center text-sm font-semibold text-orange-700 underline decoration-orange-300 underline-offset-4 hover:text-orange-900" href="/forgot-password">Quên mật khẩu?</Link>}
    >
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="flex flex-col gap-5">
          <label htmlFor="identifier" className="grid gap-2 text-sm font-semibold text-slate-800">Tên đăng nhập, thư điện tử hoặc số điện thoại
          <input
            id="identifier"
            name="identifier"
            autoComplete="username"
            className="min-h-12 w-full rounded-none border border-slate-300 px-3 py-3 text-base font-normal"
            placeholder="Nhập thông tin tài khoản"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          </label>
          <label htmlFor="password" className="grid gap-2 text-sm font-semibold text-slate-800">Mật khẩu
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            className="min-h-12 w-full rounded-none border border-slate-300 px-3 py-3 text-base font-normal"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          </label>
          <button type="submit" className="min-h-12 w-full rounded-none bg-orange-600 px-4 py-3 text-base font-semibold text-white hover:bg-orange-700">
            Đăng nhập
          </button>
          <p className="min-h-6 text-sm leading-6 text-slate-600" role="status" aria-live="polite">{message}</p>
        </form>
    </AuthShell>
  );
}
