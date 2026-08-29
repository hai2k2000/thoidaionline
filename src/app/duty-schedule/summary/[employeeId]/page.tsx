import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { dutyTaskRepository } from "@/lib/dutyTaskRepository";
import { getSessionUser } from "@/lib/serverSession";
const datePattern=/^\d{4}-\d{2}-\d{2}$/;const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const labels:Record<string,string>={completed:"Hoàn thành tốt",issues:"Có sai sót",not_completed:"Không hoàn thành"};
type Props={params:Promise<{employeeId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>};
type Review={result:string;on_time:boolean;reviewed_at:string;evidence_name:string|null};type DetailRow={id:string;due_date:string;due_time:string|null;duty_position:string;departments:{name:string}|null;assignee:{full_name:string|null}|null;duty_task_reviews:Review[]|Review|null};
export default async function DutyParticipantReviewPage({params,searchParams}:Props){
 const user=await getSessionUser();if(!user)redirect("/login");const {employeeId}=await params;const raw=await searchParams;const from=typeof raw.from==="string"?raw.from:"";const to=typeof raw.to==="string"?raw.to:"";
 if(!uuidPattern.test(employeeId)||!datePattern.test(from)||!datePattern.test(to))notFound();
 if(user.role_code!=="admin"){
  if(employeeId!==user.id)redirect("/duty-schedule?summary=restricted");
  const access=await dutyTaskRepository.isParticipant(from,to,user.id);if(!access.ok||!access.value)redirect("/duty-schedule?summary=restricted");
 }
 const result=await dutyTaskRepository.participantReviews(from,to,employeeId);if(!result.ok)throw new Error("Không tải được đánh giá lịch trực.");if(!result.rows.length)notFound();
 const rows=result.rows as unknown as DetailRow[];const name=rows[0]?.assignee?.full_name??"Nhân sự";const canViewEvidence=user.role_code==="admin"||user.id===employeeId;
 return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6"><div className="flex w-full flex-col gap-4 lg:flex-row"><AppNav currentPath="/duty-schedule" userLabel={user.full_name}/><main className="min-w-0 flex-1">
  <header className="rounded-xl border bg-white p-4 shadow-sm"><Link href={"/duty-schedule/summary?view=month&date="+from} className="text-sm font-semibold text-orange-700 hover:underline">← Quay lại tổng kết</Link><h1 className="mt-2 text-2xl font-bold">ĐÁNH GIÁ LỊCH TRỰC: {name}</h1><p className="mt-1 text-sm text-slate-600">Các ca từ {from.split("-").reverse().join("/")} đến {to.split("-").reverse().join("/")}.</p></header>
  <section className="mt-4 overflow-hidden rounded-xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Ngày trực</th><th className="px-4 py-3">Vị trí</th><th className="px-4 py-3">Phòng</th><th className="px-4 py-3">Kết quả</th><th className="px-4 py-3">Thời hạn</th><th className="px-4 py-3">Ngày chấm</th><th className="px-4 py-3">Minh chứng</th></tr></thead><tbody className="divide-y">{rows.map(row=>{const review=Array.isArray(row.duty_task_reviews)?row.duty_task_reviews[0]:row.duty_task_reviews;return <tr key={row.id} className="hover:bg-orange-50/50"><td className="px-4 py-3 font-semibold">{row.due_date.split("-").reverse().join("/")}</td><td className="px-4 py-3">{row.duty_position}</td><td className="px-4 py-3">{row.departments?.name??"—"}</td><td className="px-4 py-3">{review?labels[review.result]??review.result:<span className="text-slate-400">Chưa đánh giá</span>}</td><td className="px-4 py-3">{review?(review.on_time?<span className="text-emerald-700">Đúng hạn</span>:<span className="text-red-700">Quá hạn</span>):"—"}</td><td className="px-4 py-3">{review?new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(review.reviewed_at)):"—"}</td><td className="px-4 py-3">{review?.evidence_name?(canViewEvidence?<a href={"/api/tasks/duty/review?taskId="+row.id} target="_blank" rel="noreferrer" className="font-semibold text-orange-700 hover:underline">Xem minh chứng</a>:<span className="text-xs text-slate-400">Chỉ người trực được xem</span>):"—"}</td></tr>})}</tbody></table></div></section>
 </main></div></div>
}
