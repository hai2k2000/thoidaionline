"use client";
import { TASK_ATTACHMENT_ACCEPT, TASK_ATTACHMENT_FORMAT_MESSAGE, validateTaskAttachment } from "@/lib/taskAttachmentPolicy.mjs";


import { ChangeEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirm, usePromptDialog } from "@/components/ConfirmDialog";
import { EmptyPanel, FileBadge, FolderGlyph, LibraryFrame, buttonClass, fileTone, folderHint, libraryDate, librarySize, primaryButtonClass } from "@/components/SharedLibraryUi";
import { announcementCopy as copy } from "@/lib/announcementLibraryCopy.mjs";

type Folder = { id: string; name: string; system_key?: string | null; item_count?: number };
type Item = { id: string; kind: string; title: string; description?: string | null; url?: string | null; file_name?: string | null; mime_type?: string | null; size_bytes?: number | null; created_at?: string | null; uploaded_by_name?: string | null };

const tileClass = "group flex min-h-24 items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-orange-500";
const removeClass = "inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-500";

export default function SharedLibraryShell({ folders, items, folderId, folderName, folderKey = null, fullName, canManage, showSharedRecords = false, sharedRecordCount = null }: { folders: Folder[]; items: Item[]; folderId: string | null; folderName: string | null; folderKey?: string | null; fullName: string; canManage: boolean; showSharedRecords?: boolean; sharedRecordCount?: number | null }) {
  const router = useRouter(); const askConfirm = useConfirm(); const prompt = usePromptDialog(); const [error, setError] = useState(""); const [uploading, setUploading] = useState(false);
  const remove = async (path: string, folder: boolean) => { if (!await askConfirm({ title: folder ? copy.removeFolderTitle : copy.removeItemTitle, message: folder ? copy.removeFolderMessage : copy.removeItemMessage, tone: "danger" })) return; try { const response = await fetch(path, { method: "DELETE" }); if (!response.ok) { const data = await response.json().catch(() => null); setError(data?.error === "not_empty" ? copy.folderNotEmpty : copy.saveFailed); return; } router.refresh(); } catch { setError(copy.saveFailed); } };
  const createFolder = async () => { const name = await prompt({ title: copy.addFolder, label: copy.folderName, required: true }); if (!name) return; try { const response = await fetch("/api/shared-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "folder", name, parentId: folderId }) }); if (!response.ok) { setError(copy.saveFailed); return; } router.refresh(); } catch { setError(copy.saveFailed); } };
  const addLink = async () => { const title = await prompt({ title: copy.addLink, label: copy.linkTitle, required: true }); const url = title ? await prompt({ title: copy.addLink, label: copy.linkUrl, required: true }) : null; if (!title || !url) return; try { const response = await fetch("/api/shared-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "link", title, url, folderId }) }); if (!response.ok) { setError(copy.saveFailed); return; } router.refresh(); } catch { setError(copy.saveFailed); } };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []); if (!folderId || !files.length) return; setUploading(true); setError(""); try { for (const file of files) { const validation = await validateTaskAttachment(file); if (validation) { setError(validation); return; } const formData = new FormData(); formData.append("file", file); formData.append("folderId", folderId); formData.append("title", file.name); const response = await fetch("/api/shared-library", { method: "POST", body: formData }); if (!response.ok) { setError(TASK_ATTACHMENT_FORMAT_MESSAGE); return; } } router.refresh(); } catch { setError(TASK_ATTACHMENT_FORMAT_MESSAGE); } finally { setUploading(false); event.target.value = ""; } };
  const actions = canManage ? <>
    <button type="button" className={folderId ? buttonClass : primaryButtonClass} onClick={() => void createFolder()}>{copy.addFolder}</button>
    {folderId ? <button type="button" className={primaryButtonClass} onClick={() => void addLink()}>{copy.addLink}</button> : null}
  </> : null;
  return <LibraryFrame fullName={fullName} crumb={folderName} intro={folderId ? folderHint(folderKey) : copy.libraryIntro} actions={actions}>
    {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}
    {folderId && canManage ? <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/40 px-4 py-5 text-center text-orange-800 focus-within:ring-2 focus-within:ring-orange-500">
      <span className="font-semibold">{uploading ? copy.uploading : copy.uploadFile}</span>
      <span className="text-sm text-orange-700/80">{copy.uploadRules} {TASK_ATTACHMENT_FORMAT_MESSAGE}</span>
      <input className="sr-only" type="file" multiple accept={TASK_ATTACHMENT_ACCEPT} disabled={uploading} onChange={(event) => void upload(event)} />
    </label> : null}
    {showSharedRecords || folders.length ? <section className="space-y-3">
      {folderId ? <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{copy.libraryFoldersHeading}</h2> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {showSharedRecords ? <Link href="/library?view=csdl" className={`${tileClass} border-orange-200 bg-gradient-to-br from-orange-50 to-white`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white"><FolderGlyph kind="records" /></span>
          <span className="min-w-0 flex-1">
            <span className="block break-words font-semibold text-slate-900 group-hover:text-orange-700">{copy.sharedRecordsFolder}</span>
            <span className="mt-0.5 block text-sm text-slate-500">{copy.sharedRecordsHint}</span>
            {sharedRecordCount !== null ? <span className="mt-2 inline-flex rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">{sharedRecordCount} {copy.recordsUnit}</span> : null}
          </span>
        </Link> : null}
        {folders.map((folder) => <div key={folder.id} className="relative">
          <Link href={`/library?folder=${folder.id}`} className={`${tileClass} h-full`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700 ring-1 ring-orange-100"><FolderGlyph kind={folder.system_key} /></span>
            <span className={`min-w-0 flex-1 ${canManage && !folder.system_key ? "pr-12" : ""}`}>
              <span className="block break-words font-semibold text-slate-900 group-hover:text-orange-700">{folder.name}</span>
              <span className="mt-0.5 block text-sm text-slate-500">{folderHint(folder.system_key)}</span>
              {typeof folder.item_count === "number" ? <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{folder.item_count} {copy.itemsUnit}</span> : null}
            </span>
          </Link>
          {canManage && !folder.system_key ? <button type="button" className={`${removeClass} absolute right-2 top-2`} onClick={() => void remove(`/api/shared-library/folders/${folder.id}`, true)}>{copy.remove}</button> : null}
        </div>)}
      </div>
    </section> : null}
    {items.length ? <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border bg-white shadow-sm">
      {items.map((item) => { const meta = [item.kind === "link" ? copy.linkBadge : item.file_name && item.file_name !== item.title ? item.file_name : "", librarySize(item.size_bytes), libraryDate(item.created_at), item.uploaded_by_name ? `${copy.uploadedBy}: ${item.uploaded_by_name}` : ""].filter(Boolean); return <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <FileBadge tone={fileTone(item.kind, item.file_name, item.mime_type)} />
          <div className="min-w-0">
            <p className="break-words font-semibold text-slate-900">{item.title}</p>
            {item.description ? <p className="mt-0.5 break-words text-sm text-slate-600">{item.description}</p> : null}
            {meta.length ? <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 break-words text-xs text-slate-500">{meta.map((part) => <span key={part}>{part}</span>)}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          {item.kind === "file" ? <>
            <a className={buttonClass} target="_blank" rel="noopener noreferrer" href={`/api/shared-library/file/${item.id}?disposition=inline`}>{copy.view}</a>
            <a className={buttonClass} href={`/api/shared-library/file/${item.id}?disposition=attachment`}>{copy.download}</a>
          </> : <a className={buttonClass} target="_blank" rel="noopener noreferrer" href={item.url ?? "#"}>{copy.open}</a>}
          {canManage ? <button type="button" className={removeClass} onClick={() => void remove(`/api/shared-library/${item.id}`, false)}>{copy.remove}</button> : null}
        </div>
      </li>; })}
    </ul> : null}
    {!showSharedRecords && !folders.length && !items.length ? <EmptyPanel title={copy.emptyFolder} hint={folderId ? copy.emptyFolderHint : undefined} /> : null}
  </LibraryFrame>;
}
