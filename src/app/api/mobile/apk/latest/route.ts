import { requireReadActor } from "@/lib/serverApi";
import { MOBILE_APK_NOT_FOUND, readApkManifest } from "@/lib/mobileApk.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  try {
    return Response.json(await readApkManifest(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    return Response.json({ error: missing ? MOBILE_APK_NOT_FOUND : "Không thể đọc thông tin APK." }, { status: missing ? 404 : 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
