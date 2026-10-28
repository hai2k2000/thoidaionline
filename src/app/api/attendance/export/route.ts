import { requireReadActor } from "@/lib/serverApi";
import { resolveAttendanceAccess } from "@/lib/attendanceAccess";
import { GET as attendanceGet } from "../route";

const csvCell = (value: unknown) => {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const access = await resolveAttendanceAccess(guard.actor);
  if (!access.orgScope) return new Response("Forbidden", { status: 403 });
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Invalid month", { status: 400 });
  const url = new URL(`/api/attendance?date=${month}-01&period=month&scope=organization&recent=0`, request.url);
  const result = await attendanceGet(new Request(url, { headers: request.headers }));
  if (!result.ok) return result;
  const payload = await result.json() as { monthlyRows?: Array<any> };
  const rows = payload.monthlyRows ?? [];
  const staff = new Map<string, { name: string; department: string }>();
  for (const row of rows) staff.set(row.user_id, { name: row.staff_users?.full_name ?? "", department: row.staff_users?.department_id ?? "" });
  const days: string[] = [];
  const cursor = new Date(`${month}-01T12:00:00Z`);
  while (cursor.getUTCMonth() === Number(month.slice(5)) - 1) { if (![0, 6].includes(cursor.getUTCDay())) days.push(`${String(cursor.getUTCDate()).padStart(2, "0")}/${month.slice(5)}`); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  const headers = ["STT", "Họ tên", "Phòng", ...days, "Tổng công", "Nghỉ có phép", "Nghỉ không phép", "Công tác", "Đi muộn", "Về sớm", "Thiếu giờ ra"];
  const lines = [headers.map(csvCell).join(",")];
  [...staff.entries()].forEach(([userId, person], index) => {
    const byDay = new Map(rows.filter((r) => r.user_id === userId).map((r) => [r.work_date, r]));
    let total = 0, leave = 0, unpaid = 0, business = 0, late = 0, early = 0, missingOut = 0;
    const cells = days.map((d) => { const [day, mon] = d.split("/"); const row = byDay.get(`${month.slice(0, 4)}-${mon}-${day}`); if (!row) return ""; total += Number(row.workday ?? 0); const sources = row.attendance_sources ?? {}; if (sources.leave) leave += 1; if (sources.business || sources.event) business += 1; if ((row.note ?? "").includes("Nghỉ không lương")) unpaid += 1; if ((row.note ?? "").includes("Đi muộn")) late += 1; if ((row.note ?? "").includes("Về sớm")) early += 1; if ((row.note ?? "").includes("Thiếu giờ ra")) missingOut += 1; return sources.leave ? "P" : (sources.business || sources.event) ? "CT" : row.workday ?? 0; });
    lines.push([index + 1, person.name, person.department, ...cells, total, leave, unpaid, business, late, early, missingOut].map(csvCell).join(","));
  });
  return new Response(`\uFEFF${lines.join("\n")}\n`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename=cham-cong-${month}.csv` } });
}
