import Link from "next/link";
import AppNav from "@/components/AppNav";
import { announcementCopy as copy } from "@/lib/announcementLibraryCopy.mjs";

export type SharedRecordRow = { id: string; record_code: string; title: string; summary: string | null; record_type_name?: string | null; category_name?: string | null; department_name?: string | null; updated_at: string };

const dateText = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }); };

export default function SharedRecordsLibrary({ records, q, fullName, failed }: { records: SharedRecordRow[]; q: string; fullName: string; failed: boolean }) {
  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row lg:gap-6">
      <AppNav currentPath="/library" userLabel={fullName} />
      <main className="min-w-0 flex-1">
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <h1 className="text-2xl font-bold">{copy.libraryTitle}</h1>
          <p className="mt-1 text-sm text-slate-600">{copy.sharedRecordsIntro}</p>
          <nav className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link className="inline-flex min-h-11 items-center rounded-xl border px-3" href="/library">{copy.libraryRoot}</Link>
            <span className="inline-flex min-h-11 items-center rounded-xl bg-orange-50 px-3">{copy.sharedRecordsFolder}</span>
          </nav>
          <form className="mt-4 flex flex-wrap gap-2" action="/library" method="get">
            <input type="hidden" name="view" value="csdl" />
            <input className="h-11 min-w-0 flex-1 rounded-xl border px-3" type="search" name="q" defaultValue={q} placeholder={copy.sharedRecordsSearch} aria-label={copy.sharedRecordsSearch} />
            <button className="inline-flex min-h-11 items-center rounded-xl border px-3 font-semibold" type="submit">{copy.sharedRecordsSearchButton}</button>
          </form>
          {failed ? <p className="mt-3 text-sm text-red-700" role="alert">{copy.loadFailed}</p> : null}
          <div className="mt-5 space-y-2">
            {records.map((record) => <Link key={record.id} href={`/database/records/${record.id}`} className="block rounded-xl border p-3 hover:border-orange-300 hover:bg-orange-50/40">
              <span className="block break-words font-semibold">{record.title}</span>
              <span className="mt-1 block text-sm text-slate-600">{[record.record_code, record.record_type_name, record.category_name, record.department_name, dateText(record.updated_at)].filter(Boolean).join(" · ")}</span>
              {record.summary ? <span className="mt-1 block line-clamp-2 text-sm text-slate-500">{record.summary}</span> : null}
            </Link>)}
            {!failed && !records.length ? <p className="py-8 text-center text-slate-500">{q ? copy.sharedRecordsNoMatch : copy.sharedRecordsEmpty}</p> : null}
            {records.length >= 100 ? <p className="text-center text-sm text-slate-500">{copy.sharedRecordsLimit}</p> : null}
          </div>
        </section>
      </main>
    </div>
  </div>;
}
