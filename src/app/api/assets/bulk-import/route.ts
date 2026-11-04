import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { toAssetRepositoryActor } from "@/lib/assetApiActor";
import { canManageAssets } from "@/lib/assetAuthorization";
import { logServerAudit } from "@/lib/serverAudit";
import { validateAssetRows } from "@/lib/assetExcelSpec.mjs";
export const dynamic = "force-dynamic"; export const revalidate = 0;
const headers = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers });
async function readAll(table: string, columns: string, active = false) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = serverSupabase.from(table).select(columns).order("id").range(offset, offset + 499);
    if (active) query = query.eq("active", true);
    const result = await query;
    if (result.error) throw new Error("asset_options_failed");
    rows.push(...(result.data ?? []) as unknown as Record<string, unknown>[]);
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}
export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const session = await getSessionUser(); if (!session) return json({ error: "forbidden" }, { status: 403 });
  const actor = toAssetRepositoryActor(session); if (!canManageAssets(actor)) return json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { mode?: string; rows?: { row_number: number; values: Record<string, unknown> }[] } | null;
  if (!body || !["validate", "commit"].includes(body.mode ?? "") || !Array.isArray(body.rows)) return json({ error: "invalid_request" }, { status: 400 });
  if (!body.rows.length || body.rows.length > 1000) return json({ ok: false, valid_count: 0, errors: [{ row_number: 1, message: "Cần từ 1 đến 1000 dòng dữ liệu." }] });
  const options = await Promise.all([
    readAll("departments", "id,name,active", true), readAll("staff_users", "id,full_name,username,email,department_id,active", true), readAll("asset_locations", "id,name,active", true), readAll("assets", "id,asset_code"),
  ]).catch(() => null);
  if (!options) return json({ error: "asset_options_failed" }, { status: 500 });
  const [departments, users, locations, codes] = options;
  const validation = validateAssetRows(body.rows, { departments: departments as import("@/lib/assetExcelSpec.mjs").ExcelOption[], users: users as import("@/lib/assetExcelSpec.mjs").ExcelOption[], locations: locations as import("@/lib/assetExcelSpec.mjs").ExcelOption[], existingCodes: codes.map(row => String(row.asset_code ?? "")).filter(Boolean) });
  if (body.mode === "validate" || !validation.ok) return json({ ok: validation.ok, valid_count: validation.valid_count, errors: validation.errors });
  const rpc = await serverSupabase.rpc("api_asset_bulk_import", { p_actor_id: actor.id, p_rows: validation.resolved });
  if (rpc.error) return json({ error: rpc.error.message || "import_failed" }, { status: 400 });
  const result = rpc.data as { imported?: number; asset_codes?: string[] };
  await logServerAudit({ actorId: actor.id, module: "assets", entityType: "assets", action: "bulk_import", newData: { count: result.imported, asset_codes: result.asset_codes } });
  return json(result, { status: 201 });
}
