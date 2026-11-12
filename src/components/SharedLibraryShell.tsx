"use client";

import { ChangeEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useConfirm, usePromptDialog } from "@/components/ConfirmDialog";
import { announcementCopy as copy } from "@/lib/announcementLibraryCopy.mjs";

type Folder = { id: string; name: string; system_key?: string | null }; type Item = { id: string; kind: string; title: string; url?: string | null; file_name?: string | null };

export default function SharedLibraryShell({ folders, items, folderId, folderName, fullName, canManage, showSharedRecords = false }: { folders: Folder[]; items: Item[]; folderId: string | null; folderName: string | null; fullName: string; canManage: boolean; showSharedRecords?: boolean }) {
  const router = useRouter(); const askConfirm = useConfirm(); const prompt = usePromptDialog(); const [error, setError] = useState(""); const [uploading, setUploading] = useState(false);
  const remove = async (path: string, folder: boolean) => { if (!await askConfirm({ title: folder ? copy.removeFolderTitle : copy.removeItemTitle, message: folder ? copy.removeFolderMessage : copy.removeItemMessage, tone: "danger" })) return; try { const response = await fetch(path, { method: "DELETE" }); if (!response.ok) { const data = await response.json().catch(() => null); setError(data?.error === "not_empty" ? copy.folderNotEmpty : copy.saveFailed); return; } router.refresh(); } catch { setError(copy.saveFailed); } };
  const createFolder = async () => { const name = await prompt({ title: copy.addFolder, label: copy.folderName, required: true }); if (!name) return; try { const response = await fetch("/api/shared-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "folder", name, parentId: folderId }) }); if (!response.ok) { setError(copy.saveFailed); return; } router.refresh(); } catch { setError(copy.saveFailed); } };
  const addLink = async () => { const title = await prompt({ title: copy.addLink, label: copy.linkTitle, required: true }); const url = title ? await prompt({ title: copy.addLink, label: copy.linkUrl, required: true }) : null; if (!title || !url) return; try { const response = await fetch("/api/shared-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "link", title, url, folderId }) }); if (!response.ok) { setError(copy.saveFailed); return; } router.refresh(); } catch { setError(copy.saveFailed); } };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []); if (!folderId || !files.length) return; setUploading(true); setError(""); try { for (const file of files) { const formData = new FormData(); formData.append("file", file); formData.append("folderId", folderId); formData.append("title", file.name); const response = await fetch("/api/shared-library", { method: "POST", body: formData }); if (!response.ok) { setError(copy.uploadFailed); return; } } router.refresh(); } catch { setError(copy.uploadFailed); } finally { setUploading(false); event.target.value = ""; } };
  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
<div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row lg:gap-6">
<AppNav currentPath="/library" userLabel={fullName} />
<main className="min-w-0 flex-1">
<section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
<h1 className="text-2xl font-bold">
{copy.libraryTitle}
</h1>
<p className="mt-1 text-sm text-slate-600">
{copy.libraryIntro}
</p>
<nav className="mt-4 flex flex-wrap gap-2 text-sm">
<Link className="inline-flex min-h-11 items-center rounded-xl border px-3" href="/library">
{copy.libraryRoot}
</Link>
{folderName ? <span className="inline-flex min-h-11 items-center rounded-xl bg-orange-50 px-3">
{folderName}
</span> : null}
</nav>
{error ? <p className="mt-3 text-sm text-red-700" role="alert">
{error}
</p> : null}{canManage ? <div className="mt-4 flex flex-wrap gap-2">
<button className="inline-flex min-h-11 items-center rounded-xl border px-3 font-semibold" onClick={() => void createFolder()}>
{copy.addFolder}
</button>
{folderId ? <>
<button className="inline-flex min-h-11 items-center rounded-xl border px-3 font-semibold" onClick={() => void addLink()}>
{copy.addLink}
</button>
<label className="inline-flex min-h-11 items-center rounded-xl border px-3 font-semibold">
<span>
{uploading ? copy.uploading : copy.uploadFile}
</span>
<input className="sr-only" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" onChange={(event) => void upload(event)} />
</label>
<p className="basis-full text-sm text-slate-500">
{copy.uploadRules}
</p>
</> : null}
</div> : null}<div className="mt-5 space-y-2">
{showSharedRecords ? <div className="flex min-h-11 items-center justify-between rounded-xl border border-orange-200 bg-orange-50/50 p-3">
<Link className="min-w-0 break-words font-semibold" href="/library?view=csdl">
{copy.sharedRecordsFolder}
</Link>
</div> : null}{folders.map((folder) => <div key={folder.id} className="flex min-h-11 items-center justify-between rounded-xl border p-3">
<Link className="min-w-0 break-words font-semibold" href={`/library?folder=${folder.id}`}>
{folder.name}
</Link>
{canManage && !folder.system_key ? <button className="inline-flex min-h-11 items-center rounded-xl border px-3 text-red-700" onClick={() => void remove(`/api/shared-library/folders/${folder.id}`, true)}>
{copy.remove}
</button> : null}
</div>)}{items.map((item) => <div key={item.id} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
<span className="min-w-0 break-words font-semibold">
{item.title}
</span>
<span className="flex flex-wrap gap-2">
{item.kind === "file" ? <>
<a className="inline-flex min-h-11 items-center rounded-xl border px-3" target="_blank" rel="noopener noreferrer" href={`/api/shared-library/file/${item.id}?disposition=inline`}>
{copy.view}
</a>
<a className="inline-flex min-h-11 items-center rounded-xl border px-3" href={`/api/shared-library/file/${item.id}?disposition=attachment`}>
{copy.download}
</a>
</> : <a className="inline-flex min-h-11 items-center rounded-xl border px-3" target="_blank" rel="noopener noreferrer" href={item.url ?? "#"}>
{copy.open}
</a>}{canManage ? <button className="inline-flex min-h-11 items-center rounded-xl border px-3 text-red-700" onClick={() => void remove(`/api/shared-library/${item.id}`, false)}>
{copy.remove}
</button> : null}
</span>
</div>)}{!showSharedRecords && !folders.length && !items.length ? <p className="py-8 text-center text-slate-500">
{copy.emptyFolder}
</p> : null}
</div>
</section>
</main>
</div>
</div>;
}


