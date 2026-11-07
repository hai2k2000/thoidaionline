import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { sharedLibraryRepository } from "@/lib/sharedLibraryRepository";
import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import { serverSupabase } from "@/lib/serverSupabase";
import SharedLibraryShell from "@/components/SharedLibraryShell";
import { asUuid } from "@/lib/serverApi";

export default async function Page({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isCollaboratorRole(user.role_code)) redirect("/my-tasks");
  const raw = (await searchParams).folder;
  const folderId = raw && asUuid(raw) ? raw : null;
  const result = await sharedLibraryRepository.listFolder(folderId);
  const folder = folderId ? await serverSupabase.from("shared_library_folders").select("name").eq("id", folderId).is("deleted_at", null).maybeSingle() : { data: null };
  const canManage = hasPermission(await loadRbacActor({ id: user.id, department_id: user.department_id, role_code: user.role_code }), "library.manage");
  return <SharedLibraryShell folders={result.folders} items={result.items} folderId={folderId} folderName={folder.data?.name ?? null} fullName={user.full_name} canManage={canManage} />;
}
