import { Readable } from "node:stream";
import { requireReadActor } from "@/lib/serverApi";
import { MOBILE_APK_NOT_FOUND, mobileApkDirectory, openApkFile, readApkManifest } from "@/lib/mobileApk.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  try {
    const directory = mobileApkDirectory();
    const manifest = await readApkManifest(directory);
    const handle = await openApkFile(directory, manifest);
    const stream = Readable.toWeb(handle.createReadStream({ autoClose: true })) as ReadableStream<Uint8Array>;
    return new Response(stream, { headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="${manifest.fileName}"`,
      "Content-Length": String(manifest.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    return Response.json({ error: missing ? MOBILE_APK_NOT_FOUND : "Không thể tải APK. Vui lòng thử lại sau." }, { status: missing ? 404 : 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
