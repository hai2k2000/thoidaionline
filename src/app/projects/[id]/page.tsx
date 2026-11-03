import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { projectRepository } from "@/lib/projectRepository";
import { projectReader } from "@/lib/projectApiGuards";
import { asUuid } from "@/lib/serverApi";
import ProjectDetailShell from "@/components/ProjectDetailShell";
import { Suspense } from "react";
export default async function ProjectDetailPage({params}:{params:Promise<{id:string}>}) {
 const user = await getSessionUser(); if (!user) redirect("/login"); const {id}=await params; if (!asUuid(id)) notFound();
 const actor=projectReader(user); const project=await projectRepository.get(actor,id);
 if (!project.ok) { if(project.error.code === "42501") return <p className="p-6" role="alert">Bạn không có quyền xem dự án này.</p>; throw new Error("Không tải được dự án."); } if(!project.data) notFound();
 const [members,tasks]=await Promise.all([projectRepository.listMembers(actor,id),projectRepository.listTasks(actor,id)]);
 if(!members.ok || !tasks.ok) throw new Error("Không tải được dữ liệu dự án.");
 const lead=user.role_code === "admin" || members.data.some(member=>member.user_id===user.id && member.role==="lead" && member.staff_users?.active);
 const options=lead ? await projectRepository.options() : null;
 if(options && !options.ok) throw new Error("Không tải được nhân sự.");
 return <Suspense fallback={<p className="p-6">Đang tải dự án...</p>}><ProjectDetailShell project={project.data} members={members.data} tasks={tasks.data} actorId={user.id} actorRole={user.role_code} options={options?.ok ? options.data : null} /></Suspense>;
}
