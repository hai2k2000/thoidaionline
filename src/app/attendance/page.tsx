"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";

type AttendanceRow = {
  id: string;
  user_id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
  status: string | null;
  staff_users?: { full_name: string } | null;
};

type LeaveRequest = {
  id: string;
  requester_id: string;
  start_date: string;
  end_date: string;
  start_period: string;
  end_period: string;
  leave_type: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  review_note?: string | null;
  requester?: { full_name: string } | null;
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
  leave: "Nghỉ / Công tác",
};

const leaveTypeLabel: Record<string, string> = {
  annual: "Nghỉ phép năm",
  sick: "Nghỉ ốm",
  unpaid: "Nghỉ không lương",
  personal: "Nghỉ việc riêng",
  business: "Công tác",
};

const toDateInput = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const leaveDurationDays = (startDate: string, endDate: string) => {
  if (!startDate || !endDate || endDate < startDate) return 0;
  return Math.floor((Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86_400_000) + 1;
};

const leavePeriodLabel = (item: Pick<LeaveRequest, "start_date" | "end_date">) => {
  const days = leaveDurationDays(item.start_date, item.end_date);
  return `${item.start_date} → ${item.end_date} · ${days} ngày`;
};

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
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveApprovals, setLeaveApprovals] = useState<LeaveRequest[]>([]);
  const [leaveManagement, setLeaveManagement] = useState<LeaveRequest[]>([]);
  const [leaveForm, setLeaveForm] = useState({ startDate: selectedDate, endDate: selectedDate, startPeriod: "full", endPeriod: "full", leaveType: "annual", reason: "" });
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveError, setLeaveError] = useState("");
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

  const loadLeaveRequests = useCallback(async () => {
    const range = selectedRange(selectedDate, period);
    const response = await fetch(`/api/leave-requests?from=${range.start}&to=${range.end}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { mine?: LeaveRequest[]; approvals?: LeaveRequest[]; management?: LeaveRequest[] } | null;
    if (response.ok && payload) { setLeaveRequests(payload.mine ?? []); setLeaveApprovals(payload.approvals ?? []); setLeaveManagement(payload.management ?? []); }
  }, [period, selectedDate]);

  const submitLeave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (leaveForm.endDate < leaveForm.startDate) return setLeaveError("Ngày kết thúc không được trước ngày bắt đầu.");
    setLeaveBusy(true); setLeaveError("");
    try {
      const response = await fetch("/api/leave-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(leaveForm) });
      if (!response.ok) throw new Error("Chưa gửi được đơn. Vui lòng kiểm tra khoảng ngày và thử lại.");
      setLeaveForm((current) => ({ ...current, reason: "" })); await loadLeaveRequests();
      setLeaveModalOpen(false);
    } catch (error) { setLeaveError(error instanceof Error ? error.message : "Chưa gửi được đơn."); }
    finally { setLeaveBusy(false); }
  };

  const reviewLeave = async (request: LeaveRequest, action: "approve" | "reject") => {
    const note = action === "reject" ? window.prompt("Nhập lý do từ chối:", "")?.trim() ?? "" : "";
    if (action === "reject" && note.length < 3) return;
    setLeaveBusy(true);
    try { await fetch("/api/leave-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: request.id, action, note }) }); await loadLeaveRequests(); await loadAttendance(); } finally { setLeaveBusy(false); }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (pathname === "/attendance" && user.role_code !== "admin") return void router.push("/my-attendance");
    if (!canAccessModule("hr")) return void router.push("/");
    void loadLeaveRequests();
    const t = setTimeout(() => {
      void loadAttendance();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, router, selectedDate, pathname, isOrganizationView, loadAttendance, loadLeaveRequests]);

  useEffect(() => {
    if (!user) return;
    if (isOrganizationView) void loadSyncStatus();
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadAttendance();
      if (isOrganizationView) void loadSyncStatus();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [user, isOrganizationView, loadAttendance, loadSyncStatus]);

  const stats = useMemo(() => {
    const total = rows.length;
    const checkedIn = rows.filter((r) => !!r.check_in).length;
    const checkedOut = rows.filter((r) => !!r.check_out).length;
    return { total, checkedIn, checkedOut };
  }, [rows]);

  const monthlySummary = useMemo(() => {
    const map = new Map<string, { days: Set<string>; hours: number }>();

    monthlyRows.forEach((r) => {
      if (r.status === "leave") return;
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

  const leaveRange = useMemo(() => selectedRange(selectedDate, period), [period, selectedDate]);
  const leaveFormDays = useMemo(() => leaveDurationDays(leaveForm.startDate, leaveForm.endDate), [leaveForm.endDate, leaveForm.startDate]);
  const leaveFormActivity = leaveForm.leaveType === "business" ? "công tác" : "nghỉ";
  const visibleLeaveRequests = useMemo(() => leaveRequests.filter((item) => item.start_date <= leaveRange.end && item.end_date >= leaveRange.start), [leaveRequests, leaveRange]);
  const visibleLeaveApprovals = useMemo(() => leaveApprovals.filter((item) => item.start_date <= leaveRange.end && item.end_date >= leaveRange.start), [leaveApprovals, leaveRange]);

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

          <div className="mb-4 flex items-center justify-between rounded-xl border bg-white p-4">
            <div><h2 className="text-lg font-semibold">Đơn nghỉ / công tác</h2><p className="mt-1 text-sm text-slate-600">Đơn nghỉ hoặc công tác đã duyệt sẽ tự động hiện trong cột Ghi chú của bảng chấm công.</p></div>
            <button type="button" onClick={() => { setLeaveError(""); setLeaveModalOpen(true); }} className="min-h-11 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white">Gửi đơn nghỉ / công tác</button>
          </div>
          {leaveModalOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="leave-dialog-title">
            <form onSubmit={submitLeave} className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between"><h2 id="leave-dialog-title" className="text-lg font-semibold">Gửi đơn nghỉ / công tác</h2><button type="button" onClick={() => setLeaveModalOpen(false)} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Đóng">×</button></div>
              <p className="mt-1 text-sm text-slate-600">Chọn đầy đủ từ ngày đến ngày. Đơn nghỉ hoặc công tác từ 3 ngày trở lên bắt buộc Tổng biên tập phê duyệt.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-sm font-medium">Từ ngày<input type="date" required value={leaveForm.startDate} onChange={(e) => { const startDate = e.target.value; setLeaveForm({ ...leaveForm, startDate, endDate: leaveForm.endDate < startDate ? startDate : leaveForm.endDate }); }} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
                <label className="text-sm font-medium">Đến ngày<input type="date" required min={leaveForm.startDate} value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
                <label className="text-sm">Loại đơn<select value={leaveForm.leaveType} onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })} className="mt-1 w-full rounded border px-3 py-2"><option value="annual">Phép năm</option><option value="sick">Nghỉ ốm</option><option value="unpaid">Không lương</option><option value="personal">Việc riêng</option><option value="business">Công tác</option></select></label>
                <label className="text-sm">Thời gian<select value={leaveForm.startPeriod} onChange={(e) => setLeaveForm({ ...leaveForm, startPeriod: e.target.value, endPeriod: e.target.value })} className="mt-1 w-full rounded border px-3 py-2"><option value="full">Cả ngày</option><option value="morning">Buổi sáng</option><option value="afternoon">Buổi chiều</option></select></label>
              </div>
              <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${leaveFormDays >= 3 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`} role="status">
                {leaveFormDays > 0 ? `Thời gian ${leaveFormActivity}: ${leaveFormDays} ngày. ${leaveFormDays >= 3 ? "Đơn này sẽ chuyển Tổng biên tập phê duyệt." : "Đơn sẽ chuyển cấp quản lý có thẩm quyền phê duyệt."}` : "Vui lòng chọn khoảng ngày hợp lệ."}
              </div>
              <label className="mt-2 block text-sm">Lý do<textarea required minLength={3} maxLength={1000} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} className="mt-1 min-h-20 w-full rounded border px-3 py-2" /></label>
              {leaveError ? <p className="mt-2 text-sm font-medium text-red-700" role="alert">{leaveError}</p> : null}
              <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setLeaveModalOpen(false)} className="rounded border px-4 py-2 text-sm font-semibold">Hủy</button><button disabled={leaveBusy} className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{leaveBusy ? "Đang gửi..." : "Gửi đơn"}</button></div>
            </form>
          </div> : null}

        <section className="rounded-xl border bg-white p-4">
          {isOrganizationView ? (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Đồng bộ máy chấm công</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Máy 1 · realtime 07:30–09:30 và 16:30–18:30 · đối soát lúc 18:30.
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Nút “Đồng bộ ngay” được máy Windows xử lý nền trong ít giây, kể cả ngoài khung realtime.
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
                  <td className="min-w-64 px-3 py-2">{r.note ?? ""}</td>
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
          <h2 className="mb-2 text-lg font-semibold">Đơn nghỉ / công tác trong khoảng đã chọn</h2>
          <p className="mb-3 text-sm text-slate-600">Danh sách được lọc theo {period === "day" ? "ngày" : period === "week" ? "tuần" : "tháng"} và ngày làm mốc ở trên.</p>
          <div className="space-y-2 text-sm">
            {visibleLeaveRequests.map((item) => <div key={item.id} className="rounded border p-3"><div className="font-semibold">{leaveTypeLabel[item.leave_type] ?? "Đơn nghỉ"} · {leavePeriodLabel(item)} · {item.status === "pending" ? "Chờ duyệt" : item.status === "approved" ? "Đã duyệt" : item.status === "rejected" ? "Từ chối" : "Đã hủy"}</div>{leaveDurationDays(item.start_date, item.end_date) >= 3 ? <div className="mt-1 text-xs font-semibold text-amber-700">Cấp duyệt: Tổng biên tập</div> : null}<div className="text-slate-600">{item.reason}{item.review_note ? ` · ${item.review_note}` : ""}</div></div>)}
            {!visibleLeaveRequests.length ? <p className="text-slate-500">Không có đơn nghỉ hoặc công tác trong khoảng này.</p> : null}
          </div>
        </section>

        {visibleLeaveApprovals.length ? <section className="mt-4 rounded-xl border bg-white p-4"><h2 className="mb-2 text-lg font-semibold">Duyệt đơn nghỉ / công tác</h2><p className="mb-3 text-sm text-slate-600">Đơn nghỉ hoặc công tác từ 3 ngày trở lên chỉ hiển thị cho Tổng biên tập duyệt.</p><div className="space-y-2 text-sm">{visibleLeaveApprovals.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold">{item.requester?.full_name ?? "Nhân viên"} · {leaveTypeLabel[item.leave_type] ?? "Đơn nghỉ"} · {leavePeriodLabel(item)}</div>{leaveDurationDays(item.start_date, item.end_date) >= 3 ? <div className="mt-1 text-xs font-semibold text-amber-700">Yêu cầu Tổng biên tập phê duyệt</div> : null}<div className="text-slate-600">{item.reason}</div></div><div className="flex gap-2"><button type="button" disabled={leaveBusy} onClick={() => void reviewLeave(item, "approve")} className="min-h-11 rounded bg-emerald-700 px-3 py-2 font-semibold text-white disabled:opacity-50">Duyệt</button><button type="button" disabled={leaveBusy} onClick={() => void reviewLeave(item, "reject")} className="min-h-11 rounded border border-red-300 px-3 py-2 font-semibold text-red-700 disabled:opacity-50">Từ chối</button></div></div>)}</div></section> : null}

        {isOrganizationView ? <section className="mt-4 rounded-xl border bg-white p-4"><h2 className="mb-2 text-lg font-semibold">Quản lý đơn nghỉ / công tác</h2><p className="mb-3 text-sm text-slate-600">Admin xem toàn bộ đơn; đơn nghỉ hoặc công tác từ 3 ngày trở lên do Tổng biên tập phê duyệt.</p><div className="table-scroll rounded-lg border border-slate-200"><table className="data-table min-w-[820px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2">Nhân sự</th><th className="px-3 py-2">Loại đơn</th><th className="px-3 py-2">Thời gian</th><th className="px-3 py-2">Số ngày</th><th className="px-3 py-2">Cấp duyệt</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2">Lý do</th></tr></thead><tbody>{leaveManagement.map((item) => { const days = leaveDurationDays(item.start_date, item.end_date); return <tr key={item.id} className="border-t"><td className="px-3 py-2 font-semibold">{item.requester?.full_name ?? "-"}</td><td className="px-3 py-2">{leaveTypeLabel[item.leave_type] ?? "Đơn nghỉ"}</td><td className="whitespace-nowrap px-3 py-2">{item.start_date} → {item.end_date}</td><td className="px-3 py-2 text-center font-semibold">{days}</td><td className="px-3 py-2">{days >= 3 ? "Tổng biên tập" : "Quản lý có thẩm quyền"}</td><td className="px-3 py-2">{item.status === "pending" ? "Chờ duyệt" : item.status === "approved" ? "Đã duyệt" : item.status === "rejected" ? "Từ chối" : "Đã hủy"}</td><td className="px-3 py-2">{item.reason}</td></tr>; })}{!leaveManagement.length ? <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Không có đơn nghỉ hoặc công tác trong khoảng này.</td></tr> : null}</tbody></table></div></section> : null}

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
