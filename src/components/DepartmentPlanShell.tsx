import Link from "next/link";
import AppNav from "@/components/AppNav";
import type { DepartmentPlanPeriod } from "@/lib/departmentPlanPeriod";
import {
  departmentPlanUrl,
  formatDepartmentPlanPeriod,
  shiftDepartmentPlanStart,
} from "@/lib/departmentPlanNavigation";

type Props = {
  userLabel: string;
  departmentName: string;
  period: DepartmentPlanPeriod;
  departmentId: string;
  hasPlan: boolean;
  itemCount: number;
  currentWeeklyPeriod: DepartmentPlanPeriod;
  currentMonthlyPeriod: DepartmentPlanPeriod;
};

const tabClass = (active: boolean) => `rounded-xl px-4 py-2.5 text-sm font-bold transition ${active
  ? "bg-orange-600 text-white shadow-sm"
  : "text-slate-600 hover:bg-orange-50 hover:text-orange-800"}`;

export default function DepartmentPlanShell({
  userLabel,
  departmentName,
  period,
  departmentId,
  hasPlan,
  itemCount,
  currentWeeklyPeriod,
  currentMonthlyPeriod,
}: Props) {
  const weeklyStart = period.periodType === "weekly" ? period.periodStart : currentWeeklyPeriod.periodStart;
  const monthlyStart = period.periodType === "monthly" ? period.periodStart : currentMonthlyPeriod.periodStart;
  const previous = shiftDepartmentPlanStart(period.periodType, period.periodStart, -1);
  const next = shiftDepartmentPlanStart(period.periodType, period.periodStart, 1);
  const thisPeriod = period.periodType === "weekly" ? currentWeeklyPeriod.periodStart : currentMonthlyPeriod.periodStart;
  const periodLabel = formatDepartmentPlanPeriod(period.periodType, period.periodStart, period.periodEnd);

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row">
        <AppNav currentPath="/planning/department" userLabel={userLabel} />
        <main className="min-w-0 flex-1">
          <header className="relative overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-white via-orange-50/70 to-amber-100/70 p-5 shadow-sm sm:p-7">
            <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-orange-200/40 blur-2xl" />
            <p className="relative text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Kế hoạch phòng</p>
            <div className="relative mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">KẾ HOẠCH PHÒNG</h1>
                <p className="mt-1 text-sm font-semibold text-slate-600">{departmentName}</p>
              </div>
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-orange-900 ring-1 ring-orange-200">Chỉ đọc kỳ kế hoạch</span>
            </div>
          </header>

          <section className="mt-4 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" aria-label="Chọn loại kỳ kế hoạch">
            <div className="flex flex-wrap gap-2">
              <Link className={tabClass(period.periodType === "weekly")} href={departmentPlanUrl("weekly", weeklyStart, departmentId)}>Kế hoạch tuần</Link>
              <Link className={tabClass(period.periodType === "monthly")} href={departmentPlanUrl("monthly", monthlyStart, departmentId)}>Kế hoạch tháng</Link>
            </div>
          </section>

          <section className="mt-3 rounded-2xl border bg-white p-4 shadow-sm sm:p-5" aria-label="Điều hướng kỳ kế hoạch">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link className="min-h-11 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-sm font-bold text-orange-900 hover:bg-orange-100" href={departmentPlanUrl(period.periodType, previous, departmentId)}>
                {period.periodType === "weekly" ? "‹ Tuần trước" : "‹ Tháng trước"}
              </Link>
              <p className="text-center text-base font-extrabold text-slate-900 sm:text-lg">{periodLabel}</p>
              <Link className="min-h-11 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-sm font-bold text-orange-900 hover:bg-orange-100" href={departmentPlanUrl(period.periodType, next, departmentId)}>
                {period.periodType === "weekly" ? "Tuần sau ›" : "Tháng sau ›"}
              </Link>
            </div>
            <div className="mt-3 flex justify-center">
              <Link className="min-h-10 rounded-full border px-4 py-2 text-sm font-bold text-slate-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800" href={departmentPlanUrl(period.periodType, thisPeriod, departmentId)}>
                {period.periodType === "weekly" ? "Tuần này" : "Tháng này"}
              </Link>
            </div>
          </section>

          <section className="mt-3 rounded-2xl border border-dashed border-orange-200 bg-white/80 p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-2xl text-orange-700" aria-hidden="true">◷</div>
            <h2 className="mt-4 text-lg font-extrabold text-slate-900">{hasPlan ? "Kế hoạch đang được chuẩn bị" : "Chưa có kế hoạch cho kỳ này."}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
              {hasPlan ? `${itemCount} mục trong kỳ kế hoạch. Chức năng nhập nội dung sẽ được bổ sung ở bước tiếp theo.` : "Bạn đang xem đúng kỳ kế hoạch; việc mở kỳ này không tạo dữ liệu mới."}
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
