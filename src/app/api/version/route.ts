import { getReleaseBuild } from "../../../lib/releaseBuild.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ build: await getReleaseBuild() }, { headers: { "Cache-Control": "no-store" } });
}
