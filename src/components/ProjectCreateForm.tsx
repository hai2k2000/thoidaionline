"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
export type ProjectOptions = { people: { id: string; full_name: string; department_id: string | null; roles?: {code:string} | null }[]; departments: { id: string; name: string }[] };
const control = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal";
export default function ProjectCreateForm({ options, actorId, embedded = false }: { options: ProjectOptions; actorId: string; embedded?: boolean }) {
  const router = useRouter();
  const [roles, setRoles] = useState<Record<string, string>>({ [actorId]: "lead" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || created) return; setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: form.get("code"), name: form.get("name"), description: form.get("description"), hostDepartmentId: form.get("hostDepartmentId"), leadIds: Object.keys(roles).filter((id) => roles[id] === "lead"), deputyIds: Object.keys(roles).filter((id) => roles[id] === "deputy"), memberIds: Object.keys(roles).filter((id) => roles[id] === "member") }) });
      if (!response.ok) throw new Error(response.status === 409 ? "Mã dự án đã tồn tại." : "Không thể tạo dự án. Kiểm tra thông tin và quyền tạo dự án.");
      const body = await response.json() as { project: { id: string }; failedMemberIds: string[] }; setCreated(body.project.id);
      if (body.failedMemberIds.length) { setError(`Dự án đã tạo. Chưa thêm được: ${body.failedMemberIds.map((id) => options.people.find((person) => person.id === id)?.full_name ?? id).join(", ")}. Mở dự án để thêm lại.`); return; }
      router.push(`/projects/${body.project.id}`); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Không thể tạo dự án."); }
    finally { setBusy(false); }
  }
  const form = <form onSubmit={submit} className="mt-4 rounded-2xl border bg-white p-5 shadow-sm"><h1 className="text-2xl font-bold">Tạo dự án</h1><fieldset disabled={busy || Boolean(created)} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Mã dự án<input name="code" required maxLength={100} className={control} /></label><label className="grid gap-1 text-sm font-semibold">Tên dự án<input name="name" required maxLength={250} className={control} /></label><label className="grid gap-1 text-sm font-semibold sm:col-span-2">Mô tả<textarea name="description" rows={3} maxLength={10000} className={control} /></label><label className="grid gap-1 text-sm font-semibold sm:col-span-2">Đơn vị chủ trì<select name="hostDepartmentId" required defaultValue="" className={control}><option value="">Chọn đơn vị</option>{options.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><div className="sm:col-span-2"><h2 className="font-bold">Thành viên ban đầu</h2><p className="mt-1 text-sm text-slate-600">Bạn là Trưởng dự án để thêm thành viên ban đầu. Có thể thay đổi vai trò sau khi tạo nếu còn Trưởng dự án khác.</p><div className="mt-3 max-h-80 overflow-auto rounded-lg border">{options.people.map((person) => <label key={person.id} className="flex items-center justify-between gap-3 border-b p-3 text-sm last:border-b-0"><span>{person.full_name}<span className="block text-xs text-slate-500">{options.departments.find((department) => department.id === person.department_id)?.name ?? "Không thuộc phòng ban"}</span></span><select aria-label={`Vai trò của ${person.full_name}`} value={roles[person.id] ?? ""} disabled={person.id === actorId} onChange={(event) => setRoles({ ...roles, [person.id]: event.target.value })} className="rounded-lg border p-2"><option value="">Không tham gia</option><option value="lead" disabled={person.roles?.code==='cong_tac_vien'}>Trưởng dự án</option><option value="deputy" disabled={person.roles?.code==='cong_tac_vien'}>Phó trưởng dự án</option><option value="member">Thành viên</option></select></label>)}</div></div><button className="min-h-11 rounded-lg bg-orange-600 px-4 py-2.5 font-bold text-white disabled:opacity-50">{busy ? "Đang tạo..." : "Tạo dự án"}</button></fieldset>{error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}{created ? <Link href={`/projects/${created}`} className="mt-3 inline-block font-semibold text-orange-700 underline">Mở dự án đã tạo</Link> : null}</form>;
  if (embedded) return form;
  return <main className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[252px_1fr] lg:gap-5"><AppNav currentPath="/projects" /><section className="min-w-0"><Link href="/projects" className="text-sm font-semibold text-orange-700">{"V\u1ec1 danh s\u00e1ch d\u1ef1 \u00e1n"}</Link>{form}</section></div></main>;
}
