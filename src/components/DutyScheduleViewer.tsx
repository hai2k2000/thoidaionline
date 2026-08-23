"use client";
import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { scheduleRange } from "@/lib/dutyScheduleRange.mjs";
import Link from "next/link";
type Row = {
  id: string;
  due_date: string;
  duty_position: string;
  status: string;
  departments: { name: string } | null;
  assignee: { full_name: string | null } | null;
  reviewer: { full_name: string | null } | null;
};
const positions = [
  "Biên tập và xuất bản",
  "Biên tập bước 2",
  "Biên tập bước 1",
  "Phóng viên",
];
const labels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const formatDateVi = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return year && month && day
    ? day + String.fromCharCode(47) + month + String.fromCharCode(47) + year
    : iso;
};
const positionShort: Record<string, string> = {
  "Biên tập và xuất bản": "BT xuất bản",
  "Biên tập bước 2": "BT bước 2",
  "Biên tập bước 1": "BT bước 1",
  "Phóng viên": "Phóng viên",
};
export default function DutyScheduleViewer({
  userLabel,
  initialView,
  initialScope = "organization",
}: {
  userLabel: string;
  initialView: "day" | "week" | "month";
  initialScope?: "organization" | "personal";
}) {
  const router = useRouter();
  const { logout, user } = useAuth();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [view, setView] = useState<"day" | "week" | "month">(initialView);
  const [anchor, setAnchor] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const scope = initialScope;
  const range = useMemo(() => scheduleRange(view, anchor), [view, anchor]);
  useEffect(() => {
    fetch(`/api/duty-schedule?from=${range.from}&to=${range.to}${scope === "personal" ? "&mine=1" : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((body) => setRows(body.rows ?? []))
      .catch(() => setRows([]));
  }, [range.from, range.to, scope]);
  const byDate = useMemo(
    () =>
      new Map(
        [...new Set(rows.map((r) => r.due_date))].map((date) => [
          date,
          rows.filter((r) => r.due_date === date),
        ]),
      ),
    [rows],
  );
  const shift = (delta: number) => {
    const d = new Date(`${anchor}T12:00:00Z`);
    d.setUTCDate(
      d.getUTCDate() +
        (view === "day" ? delta : view === "week" ? delta * 7 : delta * 28),
    );
    setAnchor(d.toISOString().slice(0, 10));
  };
  const dayCards = useMemo(() => {
    const result: [string, Row[]][] = [];
    const cursor = new Date(`${range.from}T12:00:00Z`);
    const end = new Date(`${range.to}T12:00:00Z`);
    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10);
      result.push([date, byDate.get(date) ?? []]);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return result;
  }, [byDate, range.from, range.to]);
  const density =
    view === "month"
      ? {
          grid: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6",
          card: "rounded-lg border p-2",
          heading: "truncate text-xs font-bold",
          rows: "mt-1 space-y-1",
          row: "text-[11px] leading-tight",
          meta: "text-[10px] leading-tight",
        }
      : view === "week"
        ? {
            grid: "sm:grid-cols-2 lg:grid-cols-3",
            card: "rounded-xl border p-3",
            heading: "text-sm font-bold",
            rows: "mt-2 space-y-2",
            row: "text-sm leading-snug",
            meta: "text-xs leading-snug",
          }
        : {
            grid: "max-w-3xl",
            card: "rounded-2xl border p-5",
            heading: "text-lg font-bold",
            rows: "mt-3 space-y-3",
            row: "text-base leading-normal",
            meta: "text-sm leading-normal",
          };
  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="flex w-full flex-col gap-4 lg:flex-row">
        <AppNav
          currentPath="/duty-schedule"
          userLabel={userLabel}
          onLogout={() => {
            logout();
            router.replace("/login");
          }}
        />
        <main className="min-w-0 flex-1">
          <header className="rounded-xl border bg-white p-4 shadow-sm">
            <h1 className="text-2xl font-bold">LỊCH TRỰC</h1>
            <p className="mt-1 text-sm text-slate-600">
              Xem lịch trực cá nhân hoặc lịch trực toàn cơ quan.
            </p>
          </header>
          <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-2 flex rounded-lg border border-orange-200 bg-white p-1" aria-label="Phạm vi lịch trực">
                <Link href="/duty-schedule" className={`rounded-md px-3 py-1.5 text-sm font-semibold ${scope === "organization" ? "bg-orange-500 text-white" : "text-slate-600"}`}>Toàn cơ quan</Link>
                <Link href="/duty-schedule?scope=personal" className={`rounded-md px-3 py-1.5 text-sm font-semibold ${scope === "personal" ? "bg-orange-500 text-white" : "text-slate-600"}`}>Cá nhân</Link>
              </div>
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
                {(["day", "week", "month"] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setView(item)}
                    className={`px-3 py-2 text-sm ${view === item ? "bg-orange-100 font-bold" : ""}`}
                  >
                    {item === "day"
                      ? "Ngày"
                      : item === "week"
                        ? "Tuần"
                        : "Tháng"}
                  </button>
                ))}
              </div>
            </div>
            <div className={`mt-3 grid w-full gap-2 ${density.grid}`}>
              {dayCards.map(([date, items]) => (
                <article
                  key={date}
                  role={scope === "organization" && user?.role_code === "admin" && items.length ? "link" : undefined}
                  tabIndex={scope === "organization" && user?.role_code === "admin" && items.length ? 0 : undefined}
                  onClick={() => { if (scope === "organization" && user?.role_code === "admin" && items.length) router.push(`/duty-schedule/${date}`); }}
                  onKeyDown={(event) => { if (event.key === "Enter" && scope === "organization" && user?.role_code === "admin" && items.length) router.push(`/duty-schedule/${date}`); }}
                  className={`${density.card} ${scope === "organization" && user?.role_code === "admin" && items.length ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400" : ""} ${new Date(`${date}T12:00:00Z`).getUTCDay() === 6 ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200" : new Date(`${date}T12:00:00Z`).getUTCDay() === 0 ? "border-orange-400 bg-orange-50 ring-1 ring-orange-200" : "bg-white"}`}
                >
                  <h2 className={density.heading} title={date}>
                    {formatDateVi(date)} ·{" "}
                    {labels[new Date(`${date}T12:00:00Z`).getUTCDay()]}{" "}
                    {date === today ? "· Hôm nay" : ""}
                  </h2>
                  <div className={density.rows}>
                    {positions.map((position) => {
                      const row = items.find(
                        (item) => item.duty_position === position,
                      );
                      return (
                        <div
                          key={position}
                          className={`grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-1 border-t pt-1 ${density.row}`}
                        >
                          <span className="truncate" title={position}>
                            {positionShort[position] ?? position}
                          </span>
                          <span className="text-right font-semibold">
                            {row?.assignee?.full_name ?? "Chưa phân công"}
                            <br />
                            <small
                              className={`font-normal ${density.meta} text-slate-500`}
                            >
                              {row?.departments?.name ?? "—"}
                            </small>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {scope === "organization" && user?.role_code === "admin" && items.length ? <p className="mt-2 border-t pt-1 text-right text-[10px] font-bold text-orange-700">Mở đánh giá ngày →</p> : null}
                </article>
              ))}
              {!dayCards.length ? (
                <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                  Không có lịch trực trong khoảng thời gian này.
                </p>
              ) : null}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
