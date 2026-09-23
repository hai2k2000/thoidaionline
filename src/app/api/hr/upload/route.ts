import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { asUuid } from "@/lib/serverApi";

const safe = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");
const MAX_BYTES = 10 * 1024 * 1024;
const uploadDir = () => process.env.HR_UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads", "hr");
const allowed = new Map([
  ["application/pdf", { extension: "pdf", signature: [0x25, 0x50, 0x44, 0x46] }],
  ["image/jpeg", { extension: "jpg", signature: [0xff, 0xd8, 0xff] }],
  ["image/png", { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", { extension: "docx", signature: [0x50, 0x4b, 0x03, 0x04] }],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", { extension: "xlsx", signature: [0x50, 0x4b, 0x03, 0x04] }],
  ["application/msword", { extension: "doc", signature: [0xd0, 0xcf, 0x11, 0xe0] }],
]);
const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store" },
});

const canViewAllStaff = (roleCode: string, canEditAllTasks: boolean) =>
  canEditAllTasks || [
    "admin",
    "tong_bien_tap",
    "tbt_read_only",
    "pho_tong_bien_tap",
    "phu_trach_phong_tri_su",
    "phu_trach_phong_phong_vien",
    "phu_trach_phong_bien_tap",
  ].includes(roleCode);
const canEditStaff = (roleCode: string) => roleCode !== "tbt_read_only" && roleCode !== "tong_bien_tap";

export async function POST(req: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "Yêu cầu không hợp lệ." }, 403);
  const actor = await getSessionUser();
  if (!actor) return json({ error: "Phiên đăng nhập không hợp lệ." }, 401);
  if (!canEditStaff(actor.role_code)) return json({ error: "Không có quyền cập nhật hồ sơ." }, 403);
  try {
    const form = await req.formData();
    const file = form.get("file");
    const userId = String(form.get("userId") || "").trim();

    if (!(file instanceof File) || !userId) return json({ error: "Thiếu file upload hoặc userId." }, 400);
    if (userId !== actor.id && !canViewAllStaff(actor.role_code, actor.permissions.can_edit_all_tasks)) {
      return json({ error: "Không có quyền cập nhật hồ sơ này." }, 403);
    }

    const format = allowed.get(file.type);
    if (!format || file.size < format.signature.length || file.size > MAX_BYTES) {
      return json({ error: "Chỉ nhận PDF, JPG, PNG, DOCX hoặc XLSX, dung lượng tối đa 10 MB." }, 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!format.signature.every((value, index) => bytes[index] === value)) {
      return json({ error: "Nội dung tệp không đúng định dạng." }, 400);
    }
    if (!asUuid(userId)) return json({ error: "userId không hợp lệ." }, 400);
    const fileName = `${safe(userId)}-${crypto.randomUUID()}.${format.extension}`;

    const dir = uploadDir();
    await mkdir(dir, { recursive: true });

    const fullPath = path.join(dir, fileName);
    await writeFile(fullPath, bytes);

    return json({ ok: true, url: `/api/hr/upload?userId=${encodeURIComponent(userId)}&file=${encodeURIComponent(fileName)}` });
  } catch {
    return json({ error: "Không thể tải tệp lên. Vui lòng thử lại." }, 500);
  }
}

export async function GET(req: Request) {
  const actor = await getSessionUser();
  if (!actor) return json({ error: "Phiên đăng nhập không hợp lệ." }, 401);
  const params = new URL(req.url).searchParams;
  const userId = params.get("userId")?.trim() || "";
  const fileName = params.get("file")?.trim() || "";
  if (!asUuid(userId) || !fileName || userId !== actor.id && !canViewAllStaff(actor.role_code, actor.permissions.can_edit_all_tasks)) {
    return json({ error: "Không có quyền xem tệp này." }, 403);
  }
  const base = path.basename(fileName);
  const match = new RegExp(`^${userId.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}-[0-9a-f-]{36}\\.(pdf|jpg|png|docx|xlsx|doc)$`, "i").exec(base);
  if (!match) return json({ error: "Không tìm thấy tệp." }, 404);
  const filePath = path.join(/* turbopackIgnore: true */ uploadDir(), base);
  const file = await readFile(/* turbopackIgnore: true */ filePath).catch(() => null);
  if (!file) return json({ error: "Không tìm thấy tệp." }, 404);
  const info = await stat(/* turbopackIgnore: true */ filePath).catch(() => null);
  if (!info || info.size > MAX_BYTES) return json({ error: "Không tìm thấy tệp." }, 404);
  const contentType = {
    pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", doc: "application/msword",
  }[match[1].toLowerCase()] || "application/octet-stream";
  return new Response(file, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${base}"`,
      "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
