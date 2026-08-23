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
  <header className="rounded-xl border bg-white p-4 shadow-sm"><Link href={"/duty-schedule?date="+anchor} className="text-sm font-semibold text-orange-700 hover:underline">← Quay lại lịch trực</Link><h1 className="mt-2 text-2xl font-bold">TỔNG KẾT ĐÁNH GIÁ LỊCH TRỰC</h1><p className="mt-1 text-sm text-slate-600">Tạm thời chỉ người có tham gia trực trong khoảng thời gian được chọn mới xem được.</p></header>
  <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm"><div className="mb-4 flex w-fit rounded-lg border border-orange-200 bg-white p-1"><Link href="/duty-schedule" className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600">Toàn cơ quan</Link><Link href="/duty-schedule?scope=personal" className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600">Cá nhân</Link><span className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white">Tổng kết đánh giá</span></div><form method="get" className="flex flex-wrap items-end gap-2"><label className="text-sm font-semibold">Phạm vi<select name="view" defaultValue={view} className="mt-1 block rounded border px-3 py-2 font-normal"><option value="day">Ngày</option><option value="week">Tuần</option><option value="month">Tháng</option></select></label><label className="text-sm font-semibold">Ngày tham chiếu<input name="date" type="date" defaultValue={anchor} className="mt-1 block rounded border px-3 py-2 font-normal"/></label><button className="rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600">Xem tổng kết</button></form><DutySummaryTable from={range.from} to={range.to}/></section>
 </main></div></div>
}
