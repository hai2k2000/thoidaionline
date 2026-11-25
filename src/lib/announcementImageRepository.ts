import "server-only";
import { serverSupabase } from "@/lib/serverSupabase";
import { logServerAudit } from "@/lib/serverAudit";
import { orderAnnouncementImages } from "@/lib/announcementLibrary.mjs";

type AnnouncementRow = { id: string };
type AnnouncementImage = { id: string; announcement_id: string; width: number | null; height: number | null; position: number; created_at: string };

export async function attachAnnouncementImages<T extends AnnouncementRow>(rows: T[]): Promise<Array<T & { images: Array<{ id: string; url: string; width: number | null; height: number | null; position: number }> }>> {
  if (!rows.length) return [];
  try {
    const result = await announcementImageRepository.list(rows.map((row) => row.id));
    if (result.error) return rows.map((row) => ({ ...row, images: [] }));
    const byAnnouncement = new Map<string, AnnouncementImage[]>();
    for (const image of orderAnnouncementImages((result.data ?? []) as AnnouncementImage[])) {
      const list = byAnnouncement.get(image.announcement_id) ?? [];
      list.push(image);
      byAnnouncement.set(image.announcement_id, list);
    }
    return rows.map((row) => ({ ...row, images: (byAnnouncement.get(row.id) ?? []).map((image) => ({ id: image.id, url: "/api/announcements/images/" + image.id, width: image.width, height: image.height, position: image.position })) }));
  } catch {
    return rows.map((row) => ({ ...row, images: [] }));
  }
}
export const announcementImageRepository = {
  async list(announcementIds: string[]) { if (!announcementIds.length) return { data: [], error: null }; return serverSupabase.from("announcement_images").select("id,announcement_id,mime_type,width,height,position,created_at").in("announcement_id", announcementIds).is("deleted_at", null).order("position").order("created_at"); },
  async count(announcementId: string) { const result = await serverSupabase.from("announcement_images").select("id", { count: "exact", head: true }).eq("announcement_id", announcementId).is("deleted_at", null); return result.count ?? 0; },
  async add(actorId: string, announcementId: string, input: { storagePath: string; mimeType: string; sizeBytes: number; width?: number | null; height?: number | null }) { const latest = await serverSupabase.from("announcement_images").select("position").eq("announcement_id", announcementId).is("deleted_at", null).order("position", { ascending: false }).limit(1).maybeSingle(); const position = (latest.data?.position ?? -1) + 1; const result = await serverSupabase.from("announcement_images").insert({ announcement_id: announcementId, storage_path: input.storagePath, mime_type: input.mimeType, size_bytes: input.sizeBytes, width: input.width ?? null, height: input.height ?? null, position, created_by: actorId }).select("id,announcement_id,mime_type,width,height,position,created_at").single(); if (!result.error && result.data) await logServerAudit({ actorId, module: "admin", entityType: "announcement_image", entityId: result.data.id, action: "add", newData: result.data }); return result; },
  async remove(actorId: string, imageId: string) { const result = await serverSupabase.from("announcement_images").update({ deleted_at: new Date().toISOString() }).eq("id", imageId).is("deleted_at", null).select("id,announcement_id").single(); if (!result.error && result.data) await logServerAudit({ actorId, module: "admin", entityType: "announcement_image", entityId: imageId, action: "remove", newData: result.data }); return result; },
  async makeCover(actorId: string, imageId: string) { const image = await serverSupabase.from("announcement_images").select("id,announcement_id").eq("id", imageId).is("deleted_at", null).single(); if (image.error || !image.data) return image; const min = await serverSupabase.from("announcement_images").select("position").eq("announcement_id", image.data.announcement_id).is("deleted_at", null).order("position").limit(1).maybeSingle(); const result = await serverSupabase.from("announcement_images").update({ position: (min.data?.position ?? 0) - 1 }).eq("id", imageId).select("id,announcement_id,position").single(); if (!result.error) await logServerAudit({ actorId, module: "admin", entityType: "announcement_image", entityId: imageId, action: "make_cover", newData: result.data }); return result; },
  async getFile(imageId: string) { return serverSupabase.from("announcement_images").select("announcement_id,storage_path,mime_type").eq("id", imageId).is("deleted_at", null).maybeSingle(); }
};
