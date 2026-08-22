"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { scheduleRange } from "@/lib/dutyScheduleRange.mjs";
import { reporterRoleLabel } from "@/lib/onlineWorkLanguage.mjs";
type Row = {
  id: string;
  work_date: string;
  staff: { username: string; full_name: string } | null;
};
const labels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const fmt = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
export default function OnlineWorkViewer({ userLabel }: { userLabel: string }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [view, setView] = useState<"day" | "week" | "month">("month");
  const [anchor, setAnchor] = useState(new Date().toISOString().slice(0, 10));
  const range = useMemo(() => scheduleRange(view, anchor), [view, anchor]);
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    fetch(`/api/online-work-schedule?from=${range.from}&to=${range.to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b) => setRows(b.rows ?? []))
      .catch(() => setRows([]));
  }, [range.from, range.to]);
  const cards = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows)
      map.set(row.work_date, [...(map.get(row.work_date) ?? []), row]);
    const out: [string, Row[]][] = [];
    const cur = new Date(`${range.from}T12:00:00Z`),
      end = new Date(`${range.to}T12:00:00Z`);
    while (cur <= end) {
      const d = cur.toISOString().slice(0, 10);
      out.push([d, map.get(d) ?? []]);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
  }, [rows, range.from, range.to]);
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
            <h1 className="text-2xl font-bold">LỊCH LÀM ONLINE (NGOẠI NGỮ)</h1>
            <p className="mt-1 text-sm text-slate-600">
              Thời gian và người làm online.
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
                onClick={() => setAnchor(new Date().toISOString().slice(0, 10))}
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
            <div
              className={`mt-3 grid gap-2 ${view === "month" ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-3"}`}
            >
              {cards.map(([date, assignments]) => (
                <article
                  key={date}
                  className={`rounded-lg border p-3 ${new Date(`${date}T12:00:00Z`).getUTCDay() === 6 ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200" : new Date(`${date}T12:00:00Z`).getUTCDay() === 0 ? "border-orange-400 bg-orange-50 ring-1 ring-orange-200" : "bg-white"}`}
                >
                  <h2 className="font-bold">
                    {fmt(date)} ·{" "}
                    {labels[new Date(`${date}T12:00:00Z`).getUTCDay()]}
                  </h2>
                  <p className="mt-2 text-sm">
                    <span className="text-slate-500">Thời gian:</span>{" "}
                    {assignments.length ? "Cả ngày" : "—"}
                  </p>
                  <div className="text-sm">
                    <span className="text-slate-500">Người làm online:</span>
                    {assignments.length ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {assignments.map(
                          (row) =>
                            row.staff && (
                              <li key={row.id}>
                                {row.staff.full_name} ·{" "}
                                {reporterRoleLabel(row.staff.username)}
                              </li>
                            ),
                        )}
                      </ul>
                    ) : (
                      " Chưa phân công"
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
