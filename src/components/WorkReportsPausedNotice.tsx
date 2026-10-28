import Link from "next/link";
import { WORK_REPORTS_PAUSED_MESSAGE } from "@/lib/workReportsPause";

export default function WorkReportsPausedNotice() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="rounded-xl border border-orange-200 bg-orange-50 p-6 text-orange-950" role="status">
        <h1 className="text-xl font-semibold">Tạm dừng</h1>
        <p className="mt-2">{WORK_REPORTS_PAUSED_MESSAGE}</p>
        <Link href="/tasks" className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-100">
          Về danh sách công việc
        </Link>
      </section>
    </main>
  );
}
