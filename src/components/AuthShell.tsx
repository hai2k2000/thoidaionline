import Image from "next/image";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="relative flex min-h-dvh items-center bg-[#f7f7f8] px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-orange-600" />
      <section className="mx-auto grid w-full max-w-5xl overflow-hidden border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] lg:grid-cols-[0.88fr_1.12fr]">
        <header className="relative flex flex-col justify-between overflow-hidden border-b border-slate-200 bg-white p-6 text-slate-950 sm:p-8 lg:min-h-[560px] lg:border-b-0 lg:border-r">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-orange-600" />
          <div>
            <Image src="/thoidai-logo.png" alt="Báo Thời Đại" width={205} height={54} priority className="h-auto w-44 sm:w-52" />
            <p className="mt-8 max-w-xs text-sm leading-6 text-slate-600">Hệ thống quản lý công việc nội bộ Báo Thời Đại.</p>
          </div>
          <div className="mt-16 flex-1 border-y border-slate-200 py-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">Các công cụ chính</p>
            <div className="mt-5 grid gap-5">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center border border-orange-200 bg-orange-50 text-orange-700"><svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h5M8 16h8" /></svg></span>
                <div><p className="text-sm font-bold text-slate-900">Công việc</p><p className="mt-1 text-xs leading-5 text-slate-600">Theo dõi, giao và cập nhật tiến độ.</p></div>
              </div>
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center border border-orange-200 bg-orange-50 text-orange-700"><svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h5" /></svg></span>
                <div><p className="text-sm font-bold text-slate-900">Lịch làm việc</p><p className="mt-1 text-xs leading-5 text-slate-600">Xem lịch cơ quan và lịch trực.</p></div>
              </div>
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center border border-orange-200 bg-orange-50 text-orange-700"><svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3" /></svg></span>
                <div><p className="text-sm font-bold text-slate-900">Đánh giá</p><p className="mt-1 text-xs leading-5 text-slate-600">Ghi nhận kết quả và phản hồi.</p></div>
              </div>
            </div>
          </div>
          <p className="mt-12 border-t border-slate-200 pt-5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Thời Đại Work</p>
        </header>

        <div className="flex flex-col justify-center p-5 sm:p-10 lg:p-14">
          <div className="max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">Tài khoản</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-6 border-t border-slate-200 pt-5">{footer}</div> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
