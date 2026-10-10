import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { createAssetRepository } from "@/lib/assetRepository";
import { toAssetRepositoryActor } from "@/lib/assetApiActor";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const repository = createAssetRepository(serverSupabase);
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const actor = toAssetRepositoryActor(session);
  if (!actor.rbacPermissions.includes("asset.view") && !actor.rbacPermissions.includes("asset.manage")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const result = await repository.listAssetsForActor(actor, "mine");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.data, { headers: { "Cache-Control": "private, no-store" } });
}
