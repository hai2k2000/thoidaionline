"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type AttendanceRow = {
  id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
  status: string | null;
  staff_users?: { full_name: string } | null;
};

type StaffDemoRow = { id: string; full_name: string; active: boolean; roles?: { code?: string | null } | null };

type MonthlySummaryRow = {
  name: string;
  daysPresent: number;
  totalHours: number;
  workUnits: number;
};

const toDateInput = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

const monthStartOf = (dateText: string) => {
  const d = new Date(dateText);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const generateDemoDayRows = (users: StaffDemoRow[], date: string) => {
  const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
  return users.map((u, idx) => ({
    id: `demo-${u.id}-${date}`,
    work_date: date,
    check_in: toTime(8 * 60 + 2 + (idx % 35)),
    check_out: toTime(17 * 60 + 8 + (idx % 40)),
    note: "[DEMO] Chấm công mẫu",
    status: "Có mặt",
    staff_users: { full_name: u.full_name },
  })) as AttendanceRow[];
};

const generateDemoRangeRows = (users: StaffDemoRow[], fromDate: string, toDate: string) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const all: AttendanceRow[] = [];

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day === 0) continue; // Chủ nhật nghỉ demo
    const text = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    all.push(...generateDemoDayRows(users, text));
  }

  return all;
};

export default function AttendancePage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule } = useAuth();

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<AttendanceRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateInput());
  const [message, setMessage] = useState("Đang tải dữ liệu chấm công...");

  const loadAttendance = async () => {
    const startMonth = monthStartOf(selectedDate);

    const dayQuery = supabase
      .from("attendance_logs")
      .select("id,work_date,check_in,check_out,note,status,staff_users(full_name)")
      .eq("work_date", selectedDate)
      .order("check_in", { ascending: true, nullsFirst: false })
      .limit(500);

    const monthQuery = supabase
      .from("attendance_logs")
      .select("id,work_date,check_in,check_out,note,status,staff_users(full_name)")
      .gte("work_date", startMonth)
      .lte("work_date", selectedDate)
      .order("work_date", { ascending: true })
      .limit(10000);

    const [dayRes, monthRes] = await Promise.all([dayQuery, monthQuery]);

    const missingTable =
      !!dayRes.error &&
      (dayRes.error.message.includes("schema cache") || dayRes.error.message.includes("Could not find the table"));

    if (missingTable) {
      const usersRes = await supabase
        .from("staff_users")
        .select("id,full_name,active,roles(code)")
        .eq("active", true)
        .order("full_name", { ascending: true });

      if (usersRes.error) {
        setRows([]);
        setMonthlyRows([]);
        setMessage(`⚠️ Chưa tải được dữ liệu chấm công: ${usersRes.error.message}`);
        return;
      }

      const users = ((usersRes.data ?? []) as unknown as StaffDemoRow[])
        .filter((u) => (u.roles?.code ?? "") !== "tong_bien_tap");

      const demoDay = generateDemoDayRows(users, selectedDate);
      const demoMonth = generateDemoRangeRows(users, startMonth, selectedDate);

      setRows(demoDay);
      setMonthlyRows(demoMonth);
      setMessage(`✅ Đã nạp dữ liệu DEMO chấm công cho ${users.length} nhân sự (trừ Tổng biên tập).`);
      return;
    }

    if (dayRes.error || monthRes.error) {
      setRows([]);
      setMonthlyRows([]);
      setMessage(`⚠️ Chưa tải được dữ liệu chấm công: ${dayRes.error?.message || monthRes.error?.message}`);
      return;
    }

    const dayList = (dayRes.data ?? []) as unknown as AttendanceRow[];
    const monthList = (monthRes.data ?? []) as unknown as AttendanceRow[];
    setRows(dayList);
    setMonthlyRows(monthList);
    setMessage(`✅ Đã tải ${dayList.length} bản ghi ngày ${selectedDate}.`);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("hr")) return void router.push("/");
    const t = setTimeout(() => {
      void loadAttendance();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, router, selectedDate]);

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
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Chấm công</h1>
          <div className="mt-2">
            <AppNav currentPath="/attendance" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>

        <section className="rounded-xl border bg-white p-4">
          <div className="grid gap-2 md:grid-cols-4">
            <label className="text-sm md:col-span-1">
              Ngày
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
                <p className="text-xs text-emerald-700">Đã check-in</p>
                <p className="text-xl font-bold text-emerald-700">{stats.checkedIn}</p>
              </div>
              <div className="rounded border bg-sky-50 p-3">
                <p className="text-xs text-sky-700">Đã check-out</p>
                <p className="text-xl font-bold text-sky-700">{stats.checkedOut}</p>
              </div>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4 overflow-auto">
          <h2 className="mb-2 text-lg font-semibold">Bảng chấm công theo ngày</h2>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2">Nhân sự</th>
                <th className="px-2 py-2">Giờ vào</th>
                <th className="px-2 py-2">Giờ ra</th>
                <th className="px-2 py-2">Tổng giờ</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-2 font-semibold">{r.staff_users?.full_name ?? "-"}</td>
                  <td className="px-2 py-2">{r.check_in ?? "-"}</td>
                  <td className="px-2 py-2">{r.check_out ?? "-"}</td>
                  <td className="px-2 py-2">{workedHours(r.check_in, r.check_out).toFixed(2)}</td>
                  <td className="px-2 py-2">{r.status ?? "-"}</td>
                  <td className="px-2 py-2">{r.note ?? "-"}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={6}>Chưa có dữ liệu chấm công cho ngày này.</td></tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4 overflow-auto">
          <h2 className="mb-2 text-lg font-semibold">Tổng công từ đầu tháng đến ngày hiện tại</h2>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2">Nhân sự</th>
                <th className="px-2 py-2">Số ngày có công</th>
                <th className="px-2 py-2">Tổng giờ làm</th>
                <th className="px-2 py-2">Công quy đổi (8h=1 công)</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map((r) => (
                <tr key={`sum-${r.name}`} className="border-t">
                  <td className="px-2 py-2 font-semibold">{r.name}</td>
                  <td className="px-2 py-2">{r.daysPresent}</td>
                  <td className="px-2 py-2">{r.totalHours.toFixed(2)}</td>
                  <td className="px-2 py-2">{r.workUnits.toFixed(2)}</td>
                </tr>
              ))}
              {monthlySummary.length === 0 ? (
                <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={4}>Chưa có dữ liệu tổng công.</td></tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
