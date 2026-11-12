import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { sharedLibraryRepository } from "@/lib/sharedLibraryRepository";
import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import { serverSupabase } from "@/lib/serverSupabase";
import SharedLibraryShell from "@/components/SharedLibraryShell";
import SharedRecordsLibrary, { type SharedRecordRow } from "@/components/SharedRecordsLibrary";
import { listVisibleDatabaseRecords } from "@/lib/databaseManagement/repository";
import { asUuid } from "@/lib/serverApi";

export default async function Page({ searchParams }: { searchParams: Promise<{ folder?: string; view?: string; q?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isCollaboratorRole(user.role_code)) redirect("/my-tasks");
  const params = await searchParams;
  if (params.view === "csdl") {
    const q = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
    let records: SharedRecordRow[] = []; let failed = false;
    // Only approved records marked public: drafts/pending stay visible to the owning department only.
    try { records = (await listVisibleDatabaseRecords(user, { visibility: "public", status: "approved", q: q || undefined, limit: 100, sort: "updated_at", sortDir: "desc" })) as SharedRecordRow[]; } catch { failed = true; }
    return <SharedRecordsLibrary records={records} q={q} fullName={user.full_name} failed={failed} />;
  }
  const raw = params.folder;
  const folderId = raw && asUuid(raw) ? raw : null;
  const result = await sharedLibraryRepository.listFolder(folderId);
  const folder = folderId ? await serverSupabase.from("shared_library_folders").select("name").eq("id", folderId).is("deleted_at", null).maybeSingle() : { data: null };
  const canManage = hasPermission(await loadRbacActor({ id: user.id, department_id: user.department_id, role_code: user.role_code }), "library.manage");
  return <SharedLibraryShell folders={result.folders} items={result.items} folderId={folderId} folderName={folder.data?.name ?? null} fullName={user.full_name} canManage={canManage} showSharedRecords={folderId === null} />;
}
