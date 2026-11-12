import type { ReactNode } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { announcementCopy as copy } from "@/lib/announcementLibraryCopy.mjs";

export const libraryDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
};

export const librarySize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
};

type Tone = { box: string; label: string };
const tones: Record<string, Tone> = {
  pdf: { box: "bg-red-50 text-red-700 ring-red-100", label: "PDF" },
  doc: { box: "bg-blue-50 text-blue-700 ring-blue-100", label: "DOC" },
  xls: { box: "bg-emerald-50 text-emerald-700 ring-emerald-100", label: "XLS" },
  img: { box: "bg-violet-50 text-violet-700 ring-violet-100", label: "IMG" },
  link: { box: "bg-sky-50 text-sky-700 ring-sky-100", label: "URL" },
  file: { box: "bg-slate-100 text-slate-600 ring-slate-200", label: "FILE" },
};

export function fileTone(kind: string, name?: string | null, mime?: string | null): Tone {
  if (kind === "link") return tones.link;
  const value = `${name ?? ""} ${mime ?? ""}`.toLowerCase();
  if (value.includes("pdf")) return tones.pdf;
  if (/\.docx?\b|word/.test(value)) return tones.doc;
  if (/\.xlsx?\b|sheet|excel/.test(value)) return tones.xls;
  if (/\.(png|jpe?g)\b|image\//.test(value)) return tones.img;
  return tones.file;
}

export function FileBadge({ tone }: { tone: Tone }) {
  return <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold tracking-wide ring-1 ${tone.box}`}>{tone.label}</span>;
}

const folderPaths: Record<string, ReactNode> = {
  forms: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  regulations: <><path d="M12 3 4 7v5c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V7z" /><path d="m9 12 2 2 4-4" /></>,
  guides: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5M9 7h6M9 11h4" /></>,
  brand: <><circle cx="12" cy="12" r="8" /><path d="m9 12 2 2 4-4" /></>,
  records: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
};

export const folderHint = (key?: string | null) => key === "forms" ? copy.folderHintForms : key === "regulations" ? copy.folderHintRegulations : key === "guides" ? copy.folderHintGuides : key === "brand" ? copy.folderHintBrand : copy.folderHintDefault;

export function FolderGlyph({ kind, className = "" }: { kind?: string | null; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-6 w-6 fill-none stroke-current ${className}`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{folderPaths[kind ?? ""] ?? folderPaths.folder}</svg>;
}

export function LibraryFrame({ fullName, crumb, intro, actions, children }: { fullName: string; crumb?: string | null; intro: string; actions?: ReactNode; children: ReactNode }) {
  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row lg:gap-6">
      <AppNav currentPath="/library" userLabel={fullName} />
      <main className="min-w-0 flex-1 space-y-4">
        <header className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
            {crumb ? <><Link className="rounded-md px-1 py-0.5 font-medium text-orange-700 hover:bg-orange-50 focus-visible:ring-2 focus-visible:ring-orange-500" href="/library">{copy.libraryHeading}</Link><span aria-hidden="true">/</span><span className="min-w-0 break-words font-medium text-slate-700">{crumb}</span></> : <span className="font-medium text-slate-700">{copy.libraryRoot}</span>}
          </nav>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold text-slate-900">{crumb ?? copy.libraryHeading}</h1>
              <p className="mt-1 text-sm text-slate-600">{intro}</p>
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
          </div>
        </header>
        {children}
      </main>
    </div>
  </div>;
}

export const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-700 focus-visible:ring-2 focus-visible:ring-orange-500";
export const primaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-3 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2";

export function EmptyPanel({ title, hint }: { title: string; hint?: string }) {
  return <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
    <FolderGlyph className="h-8 w-8 text-slate-300" />
    <p className="font-semibold text-slate-700">{title}</p>
    {hint ? <p className="max-w-md text-sm text-slate-500">{hint}</p> : null}
  </div>;
}
