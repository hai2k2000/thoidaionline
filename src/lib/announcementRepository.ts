import "server-only";
import { serverSupabase } from "@/lib/serverSupabase";
import { logServerAudit } from "@/lib/serverAudit";
import type { AnnouncementInput } from "./announcementLibrary.d.mts";
export const announcementRepository = {
  async listActive(limit: number) { return serverSupabase.from("announcements").select("*,author:staff_users!announcements_created_by_fkey(full_name)").is("deleted_at", null).or("expires_at.is.null,expires_at.gt." + new Date().toISOString()).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(limit); },
  async get(id: string) { return serverSupabase.from("announcements").select("*,author:staff_users!announcements_created_by_fkey(full_name)").eq("id", id).is("deleted_at", null).maybeSingle(); },
  async create(actorId: string, input: AnnouncementInput) {
    const result = await serverSupabase.from("announcements").insert({ title: input.title, body: input.body, important: input.important, pinned: input.pinned, expires_at: input.expiresAt, created_by: actorId }).select("*").single();
    if (result.error || !result.data) return { ...result, notified: false };
    await logServerAudit({ actorId, module: "admin", entityType: "announcement", entityId: result.data.id, action: "create", newData: result.data });
    let notified = false;
    if (input.important) {
      const actor = await serverSupabase.from("staff_users").select("full_name").eq("id", actorId).single();
      const actorName = actor.data?.full_name ?? "";
      const users = await serverSupabase.from("staff_users").select("id,full_name,roles(code)").eq("active", true);
      if (users.error) return { ...result, notified: false };
      const rows = (users.data ?? []).filter((user) => user.id !== actorId && (Array.isArray(user.roles) ? user.roles[0] : user.roles as { code?: string } | null)?.code !== "cong_tac_vien").map((user) => ({ recipient_id: user.id, type: "announcement", title: input.title, message: input.body.slice(0, 120), href: "/announcements", event_key: "announcement:" + result.data.id + ":" + user.id, task_id: null, actor_id: actorId, actor_name: actorName }));
      if (rows.length) { const notify = await serverSupabase.from("notifications").upsert(rows, { onConflict: "event_key", ignoreDuplicates: true }); notified = !notify.error; } else notified = true;
    }
    return { ...result, notified };
  },
  async update(actorId: string, id: string, input: AnnouncementInput) { const result = await serverSupabase.from("announcements").update({ title: input.title, body: input.body, important: input.important, pinned: input.pinned, expires_at: input.expiresAt, updated_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null).select("*").single(); if (!result.error && result.data) await logServerAudit({ actorId, module: "admin", entityType: "announcement", entityId: id, action: "update", newData: result.data }); return result; },
  async remove(actorId: string, id: string) { const result = await serverSupabase.from("announcements").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null).select("*").single(); if (!result.error && result.data) await logServerAudit({ actorId, module: "admin", entityType: "announcement", entityId: id, action: "delete", newData: result.data }); return result; },
};
