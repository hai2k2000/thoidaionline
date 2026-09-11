import { apiError, apiJson, readJsonObject } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { bridgeAuthorized, configuredAttendanceDeviceId, vietnamDate } from "@/lib/attendanceBridgeAuth";

const isRealtimeWindow = () => {
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }).format(now));
  const minute = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", minute: "2-digit" }).format(now));
  const total = hour * 60 + minute;
  return (total >= 7 * 60 + 30 && total <= 9 * 60 + 30) || (total >= 16 * 60 + 30 && total <= 18 * 60 + 30);
};

export async function POST(request: Request) {
  if (!bridgeAuthorized(request)) return apiError("unauthenticated", 401);
  if (!isRealtimeWindow()) return apiJson({ ok: true, skipped: true, reason: "outside_realtime_window" });
  const body = await readJsonObject(request);
  const enroll = typeof body?.enroll_number === "string" ? body.enroll_number : "";
  const punchedAt = typeof body?.punched_at === "string" ? body.punched_at : "";
  const deviceId = typeof body?.device_id === "string" ? body.device_id : "";
  const configuredDeviceId = configuredAttendanceDeviceId();
  const instant = new Date(punchedAt);
  const localDate = vietnamDate(instant);
  if (!enroll || enroll.length > 64 || deviceId !== configuredDeviceId || !Number.isFinite(instant.valueOf()) || localDate !== vietnamDate() || Date.now() - instant.getTime() > 10 * 60 * 1000 || instant.getTime() > Date.now() + 10 * 60 * 1000) return apiError("invalid_request", 400);
  const { error: punchError } = await serverSupabase.from("attendance_punches").upsert({
    device_id: deviceId, enroll_number: enroll, punched_at: punchedAt,
    verify_mode: typeof body?.verify_mode === "number" ? body.verify_mode : null,
    in_out_mode: typeof body?.in_out_mode === "number" ? body.in_out_mode : null,
    work_code: typeof body?.work_code === "number" ? body.work_code : null,
  }, { onConflict: "device_id,enroll_number,punched_at", ignoreDuplicates: true });
  if (punchError) return apiError("operation_failed", 500);
  const { data: users, error: userError } = await serverSupabase.from("staff_users").select("id,full_name,attendance_code").eq("attendance_code", enroll).eq("active", true).limit(1);
  if (userError) return apiError("operation_failed", 500);
  const user = users?.[0];
  if (!user) return apiJson({ ok: true, matched: false });
  const { data: punches, error: listError } = await serverSupabase.from("attendance_punches").select("punched_at").eq("device_id", deviceId).eq("enroll_number", enroll).order("punched_at", { ascending: true }).limit(20000);
  if (listError) return apiError("operation_failed", 500);
  const instants = (punches ?? []).map((p) => new Date(p.punched_at)).filter((instant) => instant.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }) === localDate).sort((a, b) => a.getTime() - b.getTime());
  if (!instants.length) return apiJson({ ok: true, matched: true, work_date: localDate });
  const checkIn = instants[0].toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
  const checkOut = instants.length > 1 ? instants[instants.length - 1].toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }) : null;
  const { error: logError } = await serverSupabase.from("attendance_logs").upsert({
    user_id: user.id, work_date: localDate, check_in: checkIn, check_out: checkOut,
    status: "present", source: "wise_eye", note: "Đồng bộ realtime từ Wise Eye On 39", synced_at: new Date().toISOString(),
  }, { onConflict: "user_id,work_date" });
  if (logError) return apiError("operation_failed", 500);
  return apiJson({ ok: true, matched: true, work_date: localDate, check_in: checkIn, check_out: checkOut });
}
