import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { announcementRepository } from "@/lib/announcementRepository";
import { serverSupabase } from "@/lib/serverSupabase";
import AnnouncementShell from "@/components/AnnouncementShell";
export default async function Page() { const user = await getSessionUser(); if (!user) redirect("/login"); if (isCollaboratorRole(user.role_code)) redirect("/my-tasks"); const access = await announcementRepository.accessFor(user); const [result, departmentsResult] = await Promise.all([announcementRepository.listActive(50, access), serverSupabase.from("departments").select("id,name").eq("active", true)]); const departments = (departmentsResult.data ?? []).filter((department) => access.canManage || access.managedDepartmentIds.includes(department.id)); return <AnnouncementShell items={result.data ?? []} fullName={user.full_name} canManage={access.canManage} canPost={access.canManage || access.managedDepartmentIds.length > 0} managedDepartmentIds={access.managedDepartmentIds} departments={departments} />; }
