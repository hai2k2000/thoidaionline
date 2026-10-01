"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { scheduleRange } from "@/lib/dutyScheduleRange.mjs";
import { reporterRoleLabel } from "@/lib/onlineWorkLanguage.mjs";
import { buildOnlineWorkWeeks } from "@/lib/onlineWorkCalendar.mjs";
type Row = {
  id: string;
  work_date: string;
  staff: { username: string; full_name: string } | null;
};
type View = "day"|"week"|"month";
const labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const vietnamToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const fmt = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
export default function OnlineWorkViewer({ userLabel, initialView }: { userLabel: string; initialView: View }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [view, setView] = useState<View>(initialView);
  const [anchor, setAnchor] = useState(vietnamToday);
  const range = useMemo(() => scheduleRange(view, anchor), [view, anchor]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const begin = window.setTimeout(() => { setLoading(true); setLoadError(false); }, 0);
    fetch(`/api/online-work-schedule?from=${range.from}&to=${range.to}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b) => setRows(b.rows ?? []))
      .catch((error) => { if (error?.name !== "AbortError") { setRows([]); setLoadError(true); } })
      .finally(() => setLoading(false));
    return () => { window.clearTimeout(begin); controller.abort(); };
  }, [range.from, range.to]);
  const weeks = useMemo(
    () => buildOnlineWorkWeeks(range.from, range.to, rows),
    [rows, range.from, range.to],
  );
  // The shared calendar helper groups rows by date with new Map<string,Row[]>.
  const shift = (n: number) => {
    const d = new Date(`${anchor}T12:00:00Z`);
    d.setUTCDate(
      d.getUTCDate() + (view === "day" ? n : view === "week" ? n * 7 : n * 28),
    );
    setAnchor(d.toISOString().slice(0, 10));
  };
  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="flex w-full flex-col gap-4 lg:flex-row">
        <AppNav
          currentPath="/online-work"
          userLabel={userLabel}
          onLogout={() => {
            logout();
            router.replace("/login");
          }}
        />
        <main className="min-w-0 flex-1">
          <header className="rounded-xl border bg-white p-4 shadow-sm">
            <h1 className="text-2xl font-bold">LỊCH LÀM TRỰC TUYẾN (NGOẠI NGỮ)</h1>
            <p className="mt-1 text-sm text-slate-600">
              Thời gian và người làm trực tuyến.
            </p>
          </header>
          <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="rounded border px-3 py-2"
                onClick={() => shift(-1)}
              >
                ‹
              </button>
              <button
                className="rounded border px-3 py-2"
                onClick={() => setAnchor(vietnamToday())}
              >
                Hôm nay
              </button>
              <button
                className="rounded border px-3 py-2"
                onClick={() => shift(1)}
              >
                ›
              </button>
              <input
                type="date"
                value={anchor}
                onChange={(e) => setAnchor(e.target.value)}
                className="rounded border px-3 py-2"
              />
              <div className="ml-auto flex rounded border">
                {(["day", "week", "month"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-3 py-2 text-sm ${view === v ? "bg-orange-100 font-bold" : ""}`}
                  >
                    {v === "day" ? "Ngày" : v === "week" ? "Tuần" : "Tháng"}
                  </button>
                ))}
              </div>
            </div>
            {loading ? <p className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Đang tải lịch làm việc online…</p> : loadError ? <p role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">Không tải được lịch làm việc online. Vui lòng thử lại.</p> : (
              <div className="mt-3 space-y-3">
                {weeks.map((week) => (
                  <div key={week[0].date} className="grid grid-cols-7 gap-1 overflow-x-auto">
                    {week.map((cell, index) => (
                      <article
                        key={cell.date}
                        className={`min-w-0 rounded-lg border p-2 ${index === 5 ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200" : index === 6 ? "border-orange-400 bg-orange-50 ring-1 ring-orange-200" : "bg-white"}`}
                      >
                        <h2 className="text-sm font-bold">{labels[index]}</h2>
                        <p className="text-xs text-slate-500">{fmt(cell.date)}</p>
                        {cell.weekendLabel ? (
                          <p className="mt-2 text-sm font-medium">{cell.weekendLabel}</p>
                        ) : cell.assignments.length ? (
                          <>
                            <span className="mt-2 block text-xs text-slate-500">Người làm online:</span>
                            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                              {cell.assignments.map((row: Row) => row.staff && (
                                <li key={row.id}>{row.staff.full_name} · {reporterRoleLabel(row.staff.username)}</li>
                              ))}
                            </ul>
                          </>
                        ) : <span className="sr-only">Người làm online: chưa phân công</span>}
                      </article>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
