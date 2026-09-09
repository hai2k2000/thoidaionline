"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";

type AttendanceRow = {
  id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
  status: string | null;
  staff_users?: { full_name: string } | null;
};

type SyncRequest = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  requested_at: string;
  completed_at: string | null;
  result?: { punches_received?: number; matched_users?: number; daily_logs?: number } | null;
  error?: string | null;
};

const attendanceStatusLabel: Record<string, string> = {
  present: "Có mặt",
  absent: "Vắng",
  late: "Đi trễ",
  leave: "Nghỉ phép",
};

const toDateInput = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const selectedRange = (date: string, period: "day" | "week" | "month") => {
  const anchor = new Date(`${date}T12:00:00Z`);
  if (period === "day") return { start: date, end: date };
  if (period === "month") {
    const start = `${date.slice(0, 7)}-01`;
    const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
    return { start, end };
  }
  const day = anchor.getUTCDay();
  const start = new Date(anchor);
  start.setUTCDate(start.getUTCDate() + (day === 0 ? -6 : 1 - day));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
};

const timeToMin = (t?: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const workedHours = (checkIn?: string | null, checkOut?: string | null) => {
  const inMin = timeToMin(checkIn);
  const outMin = timeToMin(checkOut);
  if (inMin === null || outMin === null || outMin <= inMin) return 0;
  return (outMin - inMin) / 60;
};

export default function AttendancePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { loading: authLoading, user, logout, canAccessModule } = useAuth();

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<AttendanceRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateInput());
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [message, setMessage] = useState("Đang tải dữ liệu chấm công...");
  const [syncRequests, setSyncRequests] = useState<SyncRequest[]>([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const isOrganizationView = pathname === "/attendance" && user?.role_code === "admin";

  const loadSyncStatus = useCallback(async () => {
    if (!isOrganizationView) return;
    const response = await fetch("/api/attendance/sync/status", { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { requests?: SyncRequest[] } | null;
    if (response.ok && payload) {
      const requests = payload.requests ?? [];
      setSyncRequests(requests);
      const latest = requests[0];
      if (latest?.status === "succeeded" && latest.result) {
        setSyncMessage(`Đồng bộ xong: ${latest.result.punches_received ?? 0} lượt chấm, ${latest.result.matched_users ?? 0} nhân sự khớp, ${latest.result.daily_logs ?? 0} ngày công.`);
      } else if (latest?.status === "failed") {
        setSyncMessage(`Đồng bộ thất bại: ${latest.error ?? "Không rõ nguyên nhân"}`);
      }
    }
  }, [isOrganizationView]);

  const requestSync = async () => {
    const range = selectedRange(selectedDate, period);
    setSyncBusy(true);
    setSyncMessage("Đang gửi yêu cầu tới máy đồng bộ...");
    try {
      const response = await fetch("/api/attendance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: "wise-eye-on-39-machine-1",
          period,
          range_start: range.start,
          range_end: range.end,
        }),
      });
      if (!response.ok) throw new Error();
      setSyncMessage("Đã xếp hàng. Máy Windows sẽ đọc Wise Eye và cập nhật dữ liệu trong ít phút.");
      await loadSyncStatus();
    } catch {
      setSyncMessage("Chưa tạo được yêu cầu đồng bộ. Vui lòng thử lại.");
    } finally {
      setSyncBusy(false);
    }
  };

  const loadAttendance = useCallback(async () => {
    const scope = isOrganizationView ? "organization" : "personal";
    const response = await fetch(`/api/attendance?date=${encodeURIComponent(selectedDate)}&period=${period}&scope=${scope}`, {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as {
      rows?: AttendanceRow[];
      monthlyRows?: AttendanceRow[];
      message?: string;
    } | null;
    if (!response.ok || !payload) {
      setRows([]);
      setMonthlyRows([]);
      setMessage("⚠️ Chưa tải được dữ liệu chấm công.");
      return;
    }
    const dayList = payload.rows ?? [];
    setRows(dayList);
    setMonthlyRows(payload.monthlyRows ?? []);
    setMessage(`✅ ${payload.message ?? `Đã tải ${dayList.length} bản ghi.`}`);
  }, [isOrganizationView, period, selectedDate]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (pathname === "/attendance" && user.role_code !== "admin") return void router.push("/my-attendance");
    if (!canAccessModule("hr")) return void router.push("/");
    const t = setTimeout(() => {
      void loadAttendance();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, router, selectedDate, pathname, isOrganizationView, loadAttendance]);

  useEffect(() => {
    if (!isOrganizationView) return;
    void loadSyncStatus();
    const interval = window.setInterval(() => {
      void loadSyncStatus().then(() => void loadAttendance());
    }, 10000);
    return () => window.clearInterval(interval);
  }, [isOrganizationView, loadAttendance, loadSyncStatus]);

  const stats = useMemo(() => {
    const total = rows.length;
    const checkedIn = rows.filter((r) => !!r.check_in).length;
    const checkedOut = rows.filter((r) => !!r.check_out).length;
    return { total, checkedIn, checkedOut };
  }, [rows]);

  const monthlySummary = useMemo(() => {
    const map = new Map<string, { days: Set<string>; hours: number }>();

    monthlyRows.forEach((r) => {
      const name = r.staff_users?.full_name ?? "-";
      if (!map.has(name)) map.set(name, { days: new Set<string>(), hours: 0 });
      const current = map.get(name)!;
      current.days.add(r.work_date);
      current.hours += workedHours(r.check_in, r.check_out);
    });

    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        daysPresent: v.days.size,
        totalHours: Number(v.hours.toFixed(2)),
        workUnits: Number((v.hours / 8).toFixed(2)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [monthlyRows]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath={pathname} userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-bold">{isOrganizationView ? "Chấm công toàn cơ quan" : "Chấm công của tôi"}</h1>
          </div>

        <section className="rounded-xl border bg-white p-4">
          {isOrganizationView ? (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Đồng bộ máy chấm công</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Máy 1 · realtime 07:30–09:30 và 16:30–18:30 · đối soát lúc 18:30.
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Ngoài khung giờ, yêu cầu “Đồng bộ ngay” sẽ chờ đến khung đồng bộ kế tiếp.
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-700" role="status" aria-live="polite">
                  {syncMessage || (syncRequests[0]
                    ? `Lần gần nhất: ${syncRequests[0].status === "succeeded" ? "Thành công" : syncRequests[0].status === "failed" ? "Thất bại" : syncRequests[0].status === "running" ? "Đang đọc dữ liệu" : "Đang chờ máy Windows"}`
                    : "Chưa có lần đồng bộ nào.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void requestSync()}
                disabled={syncBusy || syncRequests[0]?.status === "pending" || syncRequests[0]?.status === "running"}
                className="min-h-11 shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {syncBusy ? "Đang gửi..." : syncRequests[0]?.status === "running" ? "Đang đồng bộ..." : "Đồng bộ ngay"}
              </button>
            </div>
          ) : null}
          <div className="grid gap-2 md:grid-cols-4">
            <div className="text-sm md:col-span-1">
              <label htmlFor="attendance-period">Khoảng xem</label>
              <select id="attendance-period" value={period} onChange={(e) => setPeriod(e.target.value as "day" | "week" | "month")} className="mt-1 min-h-11 w-full rounded border px-3 py-2">
                <option value="day">Theo ngày</option>
                <option value="week">Theo tuần</option>
                <option value="month">Theo tháng</option>
              </select>
            </div>
            <label className="text-sm md:col-span-1">
              Ngày làm mốc
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <div className="md:col-span-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded border bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Tổng bản ghi</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
              <div className="rounded border bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Đã chấm vào</p>
                <p className="text-xl font-bold text-emerald-700">{stats.checkedIn}</p>
              </div>
              <div className="rounded border bg-sky-50 p-3">
                <p className="text-xs text-sky-700">Đã chấm ra</p>
                <p className="text-xl font-bold text-sky-700">{stats.checkedOut}</p>
              </div>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Bảng chấm công theo {period === "day" ? "ngày" : period === "week" ? "tuần" : "tháng"}</h2>
          <div className="table-scroll rounded-lg border border-slate-200" tabIndex={0} aria-label="Bảng chấm công theo ngày, cuộn ngang để xem thêm">
          <table className="data-table min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-3 py-2">Nhân sự</th>
                <th scope="col" className="px-3 py-2">Giờ vào</th>
                <th scope="col" className="px-3 py-2">Giờ ra</th>
                <th scope="col" className="px-3 py-2 text-right">Tổng giờ</th>
                <th scope="col" className="px-3 py-2">Trạng thái</th>
                <th scope="col" className="min-w-64 px-3 py-2">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-semibold">{r.staff_users?.full_name ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.check_in ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.check_out ?? "-"}</td>
                  <td className="px-3 py-2 text-right font-semibold">{workedHours(r.check_in, r.check_out).toFixed(2)}</td>
                  <td className="px-3 py-2"><span className={`table-status ${r.status === "present" ? "table-status-success" : r.status === "late" || r.status === "leave" ? "table-status-warning" : r.status === "absent" ? "table-status-danger" : "table-status-neutral"}`}>{attendanceStatusLabel[(r.status ?? "").toLowerCase()] ?? r.status ?? "-"}</span></td>
                  <td className="min-w-64 px-3 py-2">{r.note ?? "-"}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={6}>Chưa có dữ liệu chấm công trong khoảng đã chọn.</td></tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Tổng công {period === "month" ? "trong tháng đã chọn" : period === "week" ? "trong tuần đã chọn" : "từ đầu tháng đến ngày hiện tại"}</h2>
          <div className="table-scroll rounded-lg border border-slate-200" tabIndex={0} aria-label="Bảng tổng công theo tháng, cuộn ngang để xem thêm">
          <table className="data-table min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-3 py-2">Nhân sự</th>
                <th scope="col" className="px-3 py-2 text-right">Số ngày có công</th>
                <th scope="col" className="px-3 py-2 text-right">Tổng giờ làm</th>
                <th scope="col" className="px-3 py-2 text-right">Công quy đổi (8h=1 công)</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map((r) => (
                <tr key={`sum-${r.name}`} className="border-t">
                  <td className="px-3 py-2 font-semibold">{r.name}</td>
                  <td className="px-3 py-2 text-right">{r.daysPresent}</td>
                  <td className="px-3 py-2 text-right">{r.totalHours.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{r.workUnits.toFixed(2)}</td>
                </tr>
              ))}
              {monthlySummary.length === 0 ? (
                <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={4}>Chưa có dữ liệu tổng công.</td></tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
