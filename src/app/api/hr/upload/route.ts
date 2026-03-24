import { mkdir, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

const safe = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const userId = String(form.get("userId") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file upload." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name || "");
    const fileName = `${Date.now()}-${safe(userId || "profile")}${ext || ".bin"}`;

    const dir = path.join(process.cwd(), "public", "uploads", "hr");
    await mkdir(dir, { recursive: true });

    const fullPath = path.join(dir, fileName);
    await writeFile(fullPath, bytes);

    return NextResponse.json({ ok: true, url: `/uploads/hr/${fileName}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
