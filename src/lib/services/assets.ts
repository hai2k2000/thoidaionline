import { logAudit } from "./audit";
import { db, fail, ok, ServiceResult, withError } from "./common";

export type AssetStatus = "available" | "in_use" | "maintenance" | "broken" | "liquidated";

export type Asset = {
  id?: string;
  asset_code?: string;
  asset_name: string;
  category: string;
  serial_number?: string | null;
  status?: AssetStatus;
  assigned_department_id?: string | null;
  note?: string | null;
};

export type AssetAssignment = {
  id?: string;
  asset_id: string;
  assignee_id?: string | null;
  department_id?: string | null;
  expected_return_at?: string | null;
  returned_at?: string | null;
  status?: "active" | "returned" | "lost" | "damaged";
  handover_note?: string | null;
  return_note?: string | null;
};

const nextAssetCode = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `TS-${year}-`;
  const { data } = await db.from("assets").select("asset_code").ilike("asset_code", `${prefix}%`).order("asset_code", { ascending: false }).limit(1).maybeSingle();
  const current = data?.asset_code ?? `${prefix}0000`;
  const n = Number((current.split("-")[2] ?? "0").replace(/\D/g, "")) + 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
};

export async function listAssets(): Promise<ServiceResult<Asset[]>> {
  try {
    const { data, error } = await db.from("assets").select("*").order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok((data ?? []) as Asset[]);
  } catch (error) {
    return fail(withError(error, "Không tải được danh sách tài sản."));
  }
}

export async function createAsset(input: Asset, actorId?: string): Promise<ServiceResult<Asset>> {
  if (!input.asset_name?.trim() || !input.category?.trim()) {
    return fail("Thiếu asset_name hoặc category.");
  }

  try {
    const code = input.asset_code?.trim().toUpperCase() || (await nextAssetCode());
    const { data, error } = await db
      .from("assets")
      .insert({
        ...input,
        asset_code: code,
        asset_name: input.asset_name.trim(),
        category: input.category.trim(),
        status: input.status ?? "available",
      })
      .select("*")
      .single();

    if (error) return fail(error.message);

    await logAudit({ actorId, module: "assets", entityType: "assets", entityId: data.id, action: "create", newData: data });
    return ok(data as Asset);
  } catch (error) {
    return fail(withError(error, "Không tạo được tài sản."));
  }
}

export async function assignAsset(input: AssetAssignment, actorId?: string): Promise<ServiceResult<AssetAssignment>> {
  if (!input.asset_id) return fail("Thiếu asset_id.");
  if (!input.assignee_id && !input.department_id) return fail("Cần assignee_id hoặc department_id.");

  try {
    const { data, error } = await db
      .from("asset_assignments")
      .insert({ ...input, status: input.status ?? "active", created_by: actorId ?? null })
      .select("*")
      .single();

    if (error) return fail(error.message);

    await db.from("assets").update({ status: "in_use", updated_at: new Date().toISOString() }).eq("id", input.asset_id);

    await logAudit({
      actorId,
      module: "assets",
      entityType: "asset_assignments",
      entityId: data.id,
      action: "assign",
      newData: data,
    });

    return ok(data as AssetAssignment);
  } catch (error) {
    return fail(withError(error, "Không cấp phát được tài sản."));
  }
}
