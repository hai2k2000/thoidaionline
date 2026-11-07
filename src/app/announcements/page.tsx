import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { announcementRepository } from "@/lib/announcementRepository";
import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import AnnouncementShell from "@/components/AnnouncementShell";

export default async function Page() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isCollaboratorRole(user.role_code)) redirect("/my-tasks");
  const result = await announcementRepository.listActive(50);
  const canManage = hasPermission(await loadRbacActor({ id: user.id, department_id: user.department_id, role_code: user.role_code }), "announcement.manage");
  return <AnnouncementShell items={result.data ?? []} fullName={user.full_name} canManage={canManage} />;
}
