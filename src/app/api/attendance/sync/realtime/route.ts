import { apiError, apiJson, readJsonObject } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { bridgeAuthorized } from "@/lib/attendanceBridgeAuth";

export async function POST(request: Request) {
  if (!bridgeAuthorized(request)) return apiError("unauthenticated", 401);
  const body = await readJsonObject(request);
  const enroll = typeof body?.enroll_number === "string" ? body.enroll_number : "";
  const punchedAt = typeof body?.punched_at === "string" ? body.punched_at : "";
  const deviceId = typeof body?.device_id === "string" ? body.device_id : "";
  if (!enroll || !punchedAt || !deviceId || !Number.isFinite(Date.parse(punchedAt))) return apiError("invalid_request", 400);
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
  const localDate = new Date(punchedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const { data: punches, error: listError } = await serverSupabase.from("attendance_punches").select("punched_at").eq("enroll_number", enroll).order("punched_at", { ascending: true }).limit(20000);
  if (listError) return apiError("operation_failed", 500);
  const times = (punches ?? []).filter((p) => new Date(p.punched_at).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }) === localDate).map((p) => new Date(p.punched_at).toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour12: false })).sort();
  if (!times.length) return apiJson({ ok: true, matched: true, work_date: localDate });
  const { error: logError } = await serverSupabase.from("attendance_logs").upsert({
    user_id: user.id, work_date: localDate, check_in: times[0], check_out: times.length > 1 ? times[times.length - 1] : null,
    status: "present", source: "wise_eye", note: "Đồng bộ realtime từ Wise Eye On 39", synced_at: new Date().toISOString(),
  }, { onConflict: "user_id,work_date" });
  if (logError) return apiError("operation_failed", 500);
  return apiJson({ ok: true, matched: true, work_date: localDate, check_in: times[0], check_out: times.length > 1 ? times[times.length - 1] : null });
}
