import Link from "next/link";
import { EmptyPanel, FolderGlyph, LibraryFrame, libraryDate, primaryButtonClass } from "@/components/SharedLibraryUi";
import { announcementCopy as copy } from "@/lib/announcementLibraryCopy.mjs";

export type SharedRecordRow = { id: string; record_code: string; title: string; summary: string | null; record_type_name?: string | null; category_name?: string | null; department_name?: string | null; updated_at: string; total_count?: number | null };

export default function SharedRecordsLibrary({ records, q, fullName, failed }: { records: SharedRecordRow[]; q: string; fullName: string; failed: boolean }) {
  const total = Number(records[0]?.total_count ?? records.length);
  return <LibraryFrame fullName={fullName} crumb={copy.sharedRecordsFolder} intro={copy.sharedRecordsIntro}>
    <form className="flex flex-col gap-2 rounded-2xl border bg-white p-3 shadow-sm sm:flex-row" action="/library" method="get" role="search">
      <input type="hidden" name="view" value="csdl" />
      <label className="relative block min-w-0 flex-1">
        <span className="sr-only">{copy.sharedRecordsSearch}</span>
        <input className="relative h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" type="search" name="q" defaultValue={q} placeholder={copy.sharedRecordsSearch} />
        <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 fill-none stroke-slate-400" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </label>
      <button className={primaryButtonClass} type="submit">{copy.sharedRecordsSearchButton}</button>
    </form>
    {failed ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{copy.loadFailed}</p> : null}
    {records.length ? <section className="space-y-2">
      <p className="px-1 text-sm text-slate-500">{copy.sharedRecordsCount}: <span className="font-semibold text-slate-700">{total} {copy.recordsUnit}</span></p>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border bg-white shadow-sm">
        {records.map((record) => <li key={record.id}>
          <Link href={`/database/records/${record.id}`} className="group flex items-start gap-3 p-4 hover:bg-orange-50/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700 ring-1 ring-orange-100"><FolderGlyph kind="records" /></span>
            <span className="min-w-0 flex-1">
              <span className="block break-words font-semibold text-slate-900 group-hover:text-orange-700">{record.title}</span>
              {record.summary ? <span className="mt-0.5 block line-clamp-2 break-words text-sm text-slate-600">{record.summary}</span> : null}
              <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {record.record_type_name ? <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{record.record_type_name}</span> : null}
                <span className="font-mono">{record.record_code}</span>
                {record.department_name ? <span>{record.department_name}</span> : null}
                {libraryDate(record.updated_at) ? <span>{libraryDate(record.updated_at)}</span> : null}
              </span>
            </span>
          </Link>
        </li>)}
      </ul>
      {records.length >= 100 ? <p className="px-1 text-center text-sm text-slate-500">{copy.sharedRecordsLimit}</p> : null}
    </section> : null}
    {!failed && !records.length ? <EmptyPanel title={q ? copy.sharedRecordsNoMatch : copy.sharedRecordsEmpty} /> : null}
  </LibraryFrame>;
}
