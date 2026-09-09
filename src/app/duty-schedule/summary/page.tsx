import { redirect } from "next/navigation";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import DutySummaryTable from "@/components/DutySummaryTable";
import { getSessionUser } from "@/lib/serverSession";
import { scheduleRange } from "@/lib/dutyScheduleRange.mjs";
import { dutyTaskRepository } from "@/lib/dutyTaskRepository";
type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};
export default async function DutySummaryPage({searchParams}:Props){
 const user=await getSessionUser();if(!user)redirect("/login");const raw=await searchParams;
 const view=raw.view==="day"||raw.view==="week"?raw.view:"month";
 const anchor=typeof raw.date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(raw.date)?raw.date:new Date().toISOString().slice(0,10);
 const range=scheduleRange(view,anchor);
 if(user.role_code!=="admin"){const participation=await dutyTaskRepository.isParticipant(range.from,range.to,user.id);if(!participation.ok||!participation.value)redirect("/duty-schedule?summary=restricted");}
 return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6"><div className="flex w-full flex-col gap-4 lg:flex-row"><AppNav currentPath="/duty-schedule" userLabel={user.full_name}/><main className="min-w-0 flex-1">
  <header className="rounded-xl border bg-white p-4 shadow-sm sm:p-5"><Link href={"/duty-schedule?date="+anchor} className="inline-flex min-h-10 items-center rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100">← Quay lại lịch trực</Link><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-orange-600">Đánh giá lịch trực</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Tổng kết đánh giá lịch trực</h1><p className="mt-1 text-sm text-slate-600">Tạm thời chỉ người có tham gia trực trong khoảng thời gian được chọn mới xem được.</p></header>
  <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm sm:p-5"><div className="mb-5 flex w-fit max-w-full flex-wrap rounded-lg border border-orange-200 bg-white p-1"><Link href="/duty-schedule" className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-orange-50 hover:text-orange-800">Toàn cơ quan</Link><Link href="/duty-schedule?scope=personal" className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-orange-50 hover:text-orange-800">Cá nhân</Link><span className="rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white">Tổng kết đánh giá</span></div><form method="get" className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4"><label className="grid gap-1.5 text-sm font-semibold">Phạm vi<select name="view" defaultValue={view} className="min-h-11 rounded-lg border bg-white px-3 py-2 font-normal"><option value="day">Ngày</option><option value="week">Tuần</option><option value="month">Tháng</option></select></label><label className="grid gap-1.5 text-sm font-semibold">Ngày tham chiếu<input name="date" type="date" defaultValue={anchor} className="min-h-11 rounded-lg border bg-white px-3 py-2 font-normal"/></label><button className="min-h-11 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700">Xem tổng kết</button></form><DutySummaryTable from={range.from} to={range.to}/></section>
 </main></div></div>
}
