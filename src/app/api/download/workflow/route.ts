import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "uploads", "so_do_luong_cong_viec.docx");
  const file = await readFile(filePath);
  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="so_do_luong_cong_viec.docx"',
      "Cache-Control": "no-store",
    },
  });
}
