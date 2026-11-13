"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";
import AuthShell from "@/components/AuthShell";
import { resolvePostLoginPath } from "@/lib/firstLoginPassword";

import { shouldRememberLoginDefault } from "@/lib/installApp.mjs";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setRemember(shouldRememberLoginDefault({
      userAgent: navigator.userAgent,
      standalone: window.matchMedia("(display-mode: standalone)").matches,
      iosStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    })), 0);
    return () => clearTimeout(timer);
  }, []);
  const [message, setMessage] = useState("");

  const submit = async () => {
    try {
      const res = await login(identifier.trim(), password, remember);
      if (!res.ok) return setMessage(`Đăng nhập không thành công: ${res.error}`);
      setMessage("Đăng nhập thành công.");
      router.replace(resolvePostLoginPath(res.mustChangePassword === true, new URLSearchParams(window.location.search).get("next")));
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
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="flex flex-col gap-3 lg:gap-5">
          <label htmlFor="identifier" className="grid gap-2 text-sm font-semibold text-slate-800">Tài khoản
          <input
            id="identifier"
            name="identifier"
            autoComplete="username"
            className="min-h-12 w-full rounded-none border border-slate-300 px-3 py-3 text-base font-normal"
            placeholder="Tên đăng nhập, email hoặc SĐT"
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
          <div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-800">
              <input type="checkbox" name="remember" checked={remember} onChange={(event) => setRemember(event.target.checked)} aria-describedby="remember-help" className="h-5 w-5 accent-orange-700" />
              Ghi nhớ đăng nhập
            </label>
            <p id="remember-help" className="text-sm leading-5 text-slate-600">Giữ đăng nhập 30 ngày trên thiết bị này. Không chọn trên máy dùng chung.</p>
          </div>
          <button type="submit" className="min-h-12 w-full rounded-none bg-orange-700 px-4 py-3 text-base font-semibold text-white hover:bg-orange-800">
            Đăng nhập
          </button>
          <p className="min-h-6 text-sm leading-6 text-slate-600" role="status" aria-live="polite">{message}</p>
        </form>
        <Link href="/login?next=/app" className="inline-flex min-h-11 items-center text-sm text-slate-600 underline underline-offset-4">Cài ứng dụng</Link>
    </AuthShell>
  );
}
