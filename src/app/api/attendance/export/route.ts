import { requireReadActor } from "@/lib/serverApi";
import { resolveAttendanceAccess } from "@/lib/attendanceAccess";
import { buildAttendanceExportCsv } from "@/lib/attendanceExport.mjs";
import { GET as attendanceGet } from "../route";

const FORWARDED_FILTERS = ["departmentId", "staffId", "status"];

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const access = await resolveAttendanceAccess(guard.actor);
  if (!access.orgScope) return new Response("Forbidden", { status: 403 });
  const params = new URL(request.url).searchParams;
  const month = params.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Invalid month", { status: 400 });
  const url = new URL(`/api/attendance?date=${month}-01&period=month&scope=organization&recent=0`, request.url);
  for (const key of FORWARDED_FILTERS) { const value = params.get(key); if (value) url.searchParams.set(key, value); }
  const result = await attendanceGet(new Request(url, { headers: request.headers }));
  if (!result.ok) return result;
  const payload = await result.json() as { monthlyRows?: Array<{ user_id: string; work_date: string; note?: string | null }>; grid?: { days: string[]; rows: Array<{ staffId: string; name: string; departmentName: string; cells: Array<{ date: string; code: string; workday: number }> }> } };
  const csv = buildAttendanceExportCsv(month, payload.grid ?? { days: [], rows: [] }, payload.monthlyRows ?? []);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename=cham-cong-${month}.csv` } });
}
