import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import DutyReviewCard, { type DutyReviewRow } from "@/components/DutyReviewCard";
import { getSessionUser } from "@/lib/serverSession";
import { dutyTaskRepository } from "@/lib/dutyTaskRepository";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export default async function DutyReviewDayPage({ params }: { params:Promise<{date:string}> }) {
  const user=await getSessionUser(); if(!user)redirect("/login"); if(user.role_code!=="admin")redirect("/duty-schedule");
  const {date}=await params; if(!datePattern.test(date))notFound(); const result=await dutyTaskRepository.reviewDay(date); if(!result.ok)throw new Error("Không tải được lịch trực.");
  const displayDate=date.split("-").reverse().join("/");
  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6"><div className="flex w-full flex-col gap-4 lg:flex-row"><AppNav currentPath="/duty-schedule" userLabel={user.full_name}/><main className="min-w-0 flex-1"><header className="rounded-2xl border bg-white p-4 shadow-sm"><Link href={`/duty-schedule?date=${date}`} className="text-sm font-semibold text-orange-700 hover:underline">← Quay lại lịch trực</Link><h1 className="mt-2 text-2xl font-bold">ĐÁNH GIÁ LỊCH TRỰC NGÀY {displayDate}</h1><p className="mt-1 text-sm text-slate-600">Chấm riêng kết quả, thời hạn, sai sót và minh chứng cho từng người tham gia trực.</p></header><section className="mt-4 grid gap-3 xl:grid-cols-2">{result.rows.length ? result.rows.map(row=><DutyReviewCard key={row.id} row={row as unknown as DutyReviewRow}/>):<p className="rounded-xl border border-dashed bg-white p-8 text-center text-slate-500 xl:col-span-2">Ngày này chưa có phân công lịch trực.</p>}</section></main></div></div>;
}
