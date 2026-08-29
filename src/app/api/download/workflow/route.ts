import { readFile } from "node:fs/promises";
import path from "node:path";
import { apiError, requireReadActor } from "@/lib/serverApi";

export async function GET() {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;

  const filePath = path.join(process.cwd(), "storage", "workflow", "so_do_luong_cong_viec.docx");
  const file = await readFile(filePath).catch(() => null);
  if (!file) return apiError("not_found", 404);
  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="so_do_luong_cong_viec.docx"',
      "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
