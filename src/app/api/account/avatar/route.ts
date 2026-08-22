import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

const bucket = serverSupabase.storage.from("profile-avatars");
const allowed = new Map([
  ["image/jpeg", { extension: "jpg", signature: [0xff, 0xd8, 0xff] }],
  ["image/png", { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  ["image/webp", { extension: "webp", signature: [0x52, 0x49, 0x46, 0x46] }],
]);
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "Yêu cầu không hợp lệ." }, 403);
  const actor = await getSessionUser();
  if (!actor) return json({ error: "Phiên đăng nhập không hợp lệ." }, 401);
  const form = await request.formData().catch(() => null);
  const file = form?.get("avatar");
  if (!(file instanceof File)) return json({ error: "Hãy chọn một ảnh đại diện." }, 400);
  const format = allowed.get(file.type);
  if (!format || file.size < 12 || file.size > 2 * 1024 * 1024) return json({ error: "Chỉ nhận ảnh JPG, PNG hoặc WebP, dung lượng tối đa 2 MB." }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!format.signature.every((value, index) => bytes[index] === value) || (file.type === "image/webp" && String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP")) return json({ error: "Nội dung tệp không đúng định dạng ảnh." }, 400);
  const path = `${actor.id}/avatar.${format.extension}`;
  const { error: uploadError } = await bucket.upload(path, bytes, { contentType: file.type, upsert: true, cacheControl: "3600" });
  if (uploadError) return json({ error: "Không thể tải ảnh đại diện lên." }, 500);
  const { error: updateError } = await serverSupabase.from("staff_users").update({ avatar_path: path }).eq("id", actor.id).eq("active", true);
  if (updateError) { await bucket.remove([path]); return json({ error: "Không thể lưu ảnh đại diện." }, 500); }
  await bucket.remove(["jpg", "png", "webp"].filter((item) => item !== format.extension).map((item) => `${actor.id}/avatar.${item}`));
  const signed = await bucket.createSignedUrl(path, 3600);
  return json({ ok: true, avatarUrl: signed.data?.signedUrl ?? null, message: "Đã cập nhật ảnh đại diện." });
}

export async function DELETE() {
  if (!(await isSameOriginRequest())) return json({ error: "Yêu cầu không hợp lệ." }, 403);
  const actor = await getSessionUser();
  if (!actor) return json({ error: "Phiên đăng nhập không hợp lệ." }, 401);
  const { data } = await serverSupabase.from("staff_users").select("avatar_path").eq("id", actor.id).single();
  const path = typeof data?.avatar_path === "string" ? data.avatar_path : null;
  const { error } = await serverSupabase.from("staff_users").update({ avatar_path: null }).eq("id", actor.id).eq("active", true);
  if (error) return json({ error: "Không thể xóa ảnh đại diện." }, 500);
  if (path) await bucket.remove([path]);
  return json({ ok: true, message: "Đã xóa ảnh đại diện." });
}
