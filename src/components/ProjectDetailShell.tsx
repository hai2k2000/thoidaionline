"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Project, ProjectMember, ProjectTask } from "@/lib/projectRepository";
import type { ProjectOptions } from "@/components/ProjectCreateForm";
import AppNav from "@/components/AppNav";
import CanonicalAssignmentForm, { type CanonicalAssignmentSubmit } from "@/components/CanonicalAssignmentForm";
import type { AssignmentPerson } from "@/lib/taskAssignmentRepository";
const control = "min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal";
const button = "min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50";
const statuses: Record<string,string> = { new:"Mới",waiting:"Chờ giao",in_progress:"Đang thực hiện",blocked:"Tạm dừng",pending_review:"Chờ duyệt",done:"Hoàn thành",rejected:"Từ chối",cancelled:"Đã hủy" };
async function request(url: string, method: string, body: unknown) {
 const response = await fetch(url,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 if(!response.ok) throw new Error(response.status===403 ? "Bạn không có quyền thực hiện thao tác này hoặc dự án đã đóng." : response.status===409 ? "Mã dự án đã tồn tại." : "Không thể lưu. Kiểm tra dữ liệu và bảo đảm còn ít nhất một Trưởng dự án.");
 return response.json();
}
export default function ProjectDetailShell({project,members,tasks,actorId,options}:{project:Project;members:ProjectMember[];tasks:ProjectTask[];actorId:string;options:ProjectOptions|null}) {
 const router=useRouter();
 const isLead=members.some(m=>m.user_id===actorId&&m.role==='lead'&&m.staff_users?.active);
 const [status,setStatus]=useState(''); const [assignee,setAssignee]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [assigning,setAssigning]=useState(false);
 const [createdTask,setCreatedTask]=useState<string|null>(null); const [attachment,setAttachment]=useState<File|null>(null); const [uploadBusy,setUploadBusy]=useState(false);
 const [newUser,setNewUser]=useState(''); const [newRole,setNewRole]=useState<'member'|'lead'>('member');
 const people: AssignmentPerson[]=members.filter(m=>m.staff_users?.active).map(m=>({id:m.user_id,fullName:m.staff_users!.full_name,departmentId:null,roleCode:null,canReview:m.role==='lead',canReviewOutsideDepartment:false}));
 const leadPeople=people.filter(p=>p.canReview);
 const visibleTasks=tasks.filter(t=>(!status||t.status===status)&&(!assignee||t.assignee_id===assignee));
 const name=(id:string|null)=>members.find(m=>m.user_id===id)?.staff_users?.full_name??'—';
 async function mutate(url:string,method:string,body:unknown) {
  if(busy) return; setBusy(true);setMessage('');
  try {await request(url,method,body);router.refresh();}
  catch(error){setMessage(error instanceof Error?error.message:'Không thể lưu.');}
  finally{setBusy(false);}
 }
 async function upload(taskId:string,file:File) {
  setUploadBusy(true);
  try {const form=new FormData();form.set('file',file);const response=await fetch(`/api/tasks/${taskId}/attachments`,{method:'POST',body:form});if(!response.ok)throw new Error();setAttachment(null);setMessage('Đã tạo công việc và tải tệp đính kèm.');}
  catch {setMessage('Công việc đã tạo, nhưng tệp chưa tải lên. Bấm Thử tải lại để tiếp tục; không cần giao việc lại.');}
  finally{setUploadBusy(false);}
 }
 async function assign({payload,cards}:CanonicalAssignmentSubmit) {
  if(createdTask) return;
  const result=await request(`/api/projects/${project.id}/tasks`,'POST',payload) as {task:{id:string}};
  setCreatedTask(result.task.id);setMessage('Đã giao công việc.');
  const file=cards[0].attachment;
  if(file){setAttachment(file);await upload(result.task.id,file);}
  router.refresh();
 }
 function update(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();const form=new FormData(event.currentTarget);
  void mutate(`/api/projects/${project.id}`,'PATCH',{code:form.get('code'),name:form.get('name'),description:form.get('description'),hostDepartmentId:form.get('hostDepartmentId')});
 }
 return <main className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[252px_minmax(0,1fr)] lg:gap-5"><AppNav currentPath={`/projects/${project.id}`} /><div className="min-w-0">
  <Link href="/projects" className="text-sm font-semibold text-orange-700">Về danh sách dự án</Link>
  <header className="mt-3 rounded-2xl border bg-white p-5 shadow-sm"><p className="font-mono text-xs text-slate-500">{project.code}</p><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="mt-1 text-3xl font-bold">{project.name}</h1><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{project.status==='active'?'Đang hoạt động':'Đã đóng'}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{project.description}</p>
  {isLead&&options?<details className="mt-4"><summary className="cursor-pointer font-semibold text-orange-700">Sửa thông tin dự án</summary><form onSubmit={update} className="mt-3 grid gap-3 sm:grid-cols-2"><fieldset disabled={busy} className="contents"><label className="grid gap-1 text-sm font-semibold">Mã dự án<input name="code" required maxLength={100} defaultValue={project.code} className={control}/></label><label className="grid gap-1 text-sm font-semibold">Tên dự án<input name="name" required maxLength={250} defaultValue={project.name} className={control}/></label><label className="grid gap-1 text-sm font-semibold sm:col-span-2">Mô tả<textarea name="description" maxLength={10000} defaultValue={project.description??''} className={control}/></label><label className="grid gap-1 text-sm font-semibold">Đơn vị chủ trì<select name="hostDepartmentId" defaultValue={project.host_department_id} className={control}>{options.departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><button className={`${button} self-end bg-orange-600 text-white`}>Lưu thông tin</button></fieldset></form></details>:null}
  {isLead&&project.status==='active'?<button disabled={busy} onClick={()=>void mutate(`/api/projects/${project.id}`,'PATCH',{action:'close'})} className={`${button} mt-3 text-rose-700`}>Đóng dự án</button>:null}</header>
  {message?<p role="status" className="mt-3 rounded-lg border bg-white p-3 text-sm">{message}</p>:null}
  <section className="mt-4 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Thành viên ({members.length})</h2>
  {isLead&&options?<form onSubmit={event=>{event.preventDefault();void mutate(`/api/projects/${project.id}/members`,'POST',{userId:newUser,role:newRole});}} className="mt-3 flex flex-wrap items-end gap-2"><label className="grid gap-1 text-sm font-semibold">Nhân sự đang hoạt động<select value={newUser} required onChange={e=>setNewUser(e.target.value)} className={control}><option value="">Chọn nhân sự</option>{options.people.filter(p=>!members.some(m=>m.user_id===p.id)).map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Vai trò<select value={newRole} onChange={e=>setNewRole(e.target.value as 'lead'|'member')} className={control}><option value="member">Thành viên</option><option value="lead">Trưởng dự án</option></select></label><button disabled={busy||!newUser} className={`${button} bg-orange-600 text-white`}>Thêm thành viên</button></form>:null}
  <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Nhân sự</th><th className="p-2">Vai trò</th>{isLead?<th className="p-2">Thao tác</th>:null}</tr></thead><tbody>{members.map(member=><tr key={member.user_id} className="border-b last:border-0"><td className="p-2">{member.staff_users?.full_name??member.user_id}{!member.staff_users?.active?' (Ngừng hoạt động)':''}</td><td className="p-2">{isLead?<select aria-label={`Vai trò của ${name(member.user_id)}`} value={member.role} disabled={busy||!member.staff_users?.active} onChange={e=>void mutate(`/api/projects/${project.id}/members`,'POST',{userId:member.user_id,role:e.target.value})} className={control}><option value="lead">Trưởng dự án</option><option value="member">Thành viên</option></select>:member.role==='lead'?'Trưởng dự án':'Thành viên'}</td>{isLead?<td className="p-2"><button disabled={busy} onClick={()=>void mutate(`/api/projects/${project.id}/members`,'DELETE',{userId:member.user_id})} className={`${button} text-rose-700`}>Xóa</button></td>:null}</tr>)}</tbody></table></div></section>
  <section className="mt-4 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Công việc trong dự án</h2><div className="mt-3 flex flex-wrap gap-3"><label className="grid gap-1 text-sm font-semibold">Trạng thái<select value={status} onChange={e=>setStatus(e.target.value)} className={control}><option value="">Mọi trạng thái</option>{Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Người làm<select value={assignee} onChange={e=>setAssignee(e.target.value)} className={control}><option value="">Mọi người</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{name(m.user_id)}</option>)}</select></label></div><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Công việc</th><th className="p-2">Trạng thái</th><th className="p-2">Người làm</th><th className="p-2">Hạn</th></tr></thead><tbody>{visibleTasks.map(task=><tr key={task.id} className="border-b last:border-0"><td className="p-2"><Link href={`/tasks/${task.id}`} className="font-semibold text-orange-700 underline">{task.title}</Link></td><td className="p-2">{statuses[task.status]??task.status}</td><td className="p-2">{name(task.assignee_id)}</td><td className="whitespace-nowrap p-2">{task.due_date??'—'}</td></tr>)}</tbody></table>{!visibleTasks.length?<p className="p-6 text-center text-sm text-slate-500">Không có công việc phù hợp.</p>:null}</div></section>
  {isLead&&project.status==='active'?<section className="mt-4"><button type="button" className={`${button} bg-orange-600 text-white`} onClick={()=>setAssigning(!assigning)} aria-expanded={assigning}>Giao việc trong dự án</button>{assigning&&!createdTask?<CanonicalAssignmentForm departments={[]} people={people} projectMode={{hostDepartmentId:project.host_department_id,currentUserId:actorId,leads:leadPeople}} onSubmit={assign} onCancel={()=>setAssigning(false)} />:null}</section>:null}
  {createdTask?<div className="mt-4 rounded-lg border bg-white p-4"><Link className="font-semibold text-orange-700 underline" href={`/tasks/${createdTask}`}>Mở công việc đã tạo</Link>{attachment?<button disabled={uploadBusy} className={`${button} ml-3`} onClick={()=>void upload(createdTask,attachment)}>{uploadBusy?'Đang tải...':'Thử tải lại tệp'}</button>:<button className={`${button} ml-3`} onClick={()=>{setCreatedTask(null);setAssigning(true);setMessage('');}}>Giao việc tiếp</button>}</div>:null}
 </div></div></main>;
}
