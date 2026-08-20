import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminTaskEditForm from "@/components/AdminTaskEditForm";
import { getSessionUser } from "@/lib/serverSession";
import { taskRepository } from "@/lib/taskRepository";
type Props={params:Promise<{id:string}>};
export default async function AdminTaskEditPage({params}:Props){
  const user=await getSessionUser(); if(!user) redirect("/login"); if(user.role_code!=="admin") redirect("/tasks");
  const {id}=await params; if(!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail=await taskRepository.detail(id); if(!detail.ok||!detail.data||!detail.data.start_date||!detail.data.due_date) notFound();
  return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900 sm:px-6"><div className="mx-auto max-w-4xl"><Link href={`/tasks/${id}`} className="text-sm font-semibold text-orange-700">← Chi tiết công việc</Link><h1 className="my-4 text-2xl font-bold">CHỈNH SỬA CÔNG VIỆC</h1><AdminTaskEditForm task={detail.data}/></div></main>;
}
