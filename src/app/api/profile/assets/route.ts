import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { createAssetRepository } from "@/lib/assetRepository";
import { toAssetRepositoryActor } from "@/lib/assetApiActor";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const repository = createAssetRepository(serverSupabase);

export async function GET() {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const result = await repository.listAssetsForActor(toAssetRepositoryActor(actor));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "forbidden" ? 403 : 500 });
  return NextResponse.json(result.data, { headers: { "Cache-Control": "private, no-store" } });
}
