import "server-only";
import { serverSupabase } from "@/lib/serverSupabase";
import { FOREIGN_REPORTERS } from "@/lib/onlineWorkLanguage.mjs";

export const onlineWorkRepository = {
  async reporters() {
    const { data, error } = await serverSupabase.from("staff_users")
      .select("id,username,full_name,job_titles!inner(code)")
      .eq("active", true).like("job_titles.code", "phong_vien_%").in("username", Object.keys(FOREIGN_REPORTERS)).order("full_name");
    return error ? { ok: false as const, error } : { ok: true as const, people: data ?? [] };
  },
  async month(month: string) {
    const { data, error } = await serverSupabase.from("online_work_schedules")
      .select("id,work_date,staff_id,status").eq("status", "active")
      .gte("work_date", `${month}-01`).lte("work_date", `${month}-31`).order("work_date");
    return error ? { ok: false as const, error } : { ok: true as const, rows: data ?? [] };
  },
  async range(from: string, to: string) {
    const { data, error } = await serverSupabase.from("online_work_schedules")
      .select("id,work_date,staff:staff_users!online_work_schedules_staff_id_fkey(username,full_name)")
      .eq("status", "active").gte("work_date", from).lte("work_date", to).order("work_date");
    return error ? { ok: false as const, error } : { ok: true as const, rows: data ?? [] };
  },
  async save(actorId: string, month: string, days: { date: string; staffIds: string[] }[]) {
    const { data, error } = await serverSupabase.rpc("api_save_monthly_online_work_schedule", {
      p_actor: actorId, p_work_month: `${month}-01`, p_days: days,
    });
    return error ? { ok: false as const, error } : { ok: true as const, summary: data };
  },
};
