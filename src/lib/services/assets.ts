import { fail, ok, ServiceResult, withError } from "./common";

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
  assigned_to_label?: string;
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

const parse = async <T>(response: Response, fallback: string): Promise<ServiceResult<T>> => {
  const body = await response.json().catch(() => null) as { error?: string; asset?: T; assignment?: T; assets?: T[]; assignments?: unknown[]; users?: unknown[]; departments?: unknown[] } | null;
  if (!response.ok) return fail(body?.error || fallback);
  return ok(body as T);
};

export async function listAssets(): Promise<ServiceResult<Asset[]>> {
  try {
    const response = await fetch("/api/assets", { cache: "no-store" });
    const result = await parse<{ assets?: Asset[] }>(response, "Không tải được danh sách tài sản.");
    return result.ok ? ok(result.data.assets ?? []) : result;
  } catch (error) {
    return fail(withError(error, "Không tải được danh sách tài sản."));
  }
}

export async function createAsset(input: Asset, actorId?: string): Promise<ServiceResult<Asset>> {
  if (!input.asset_name?.trim() || !input.category?.trim()) {
    return fail("Thiếu asset_name hoặc category.");
  }

  try {
    const response = await fetch("/api/assets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, actorId }) });
    const result = await parse<{ asset?: Asset }>(response, "Không tạo được tài sản.");
    return result.ok && result.data.asset ? ok(result.data.asset) : result.ok ? fail("Không tạo được tài sản.") : result;
  } catch (error) {
    return fail(withError(error, "Không tạo được tài sản."));
  }
}

export async function assignAsset(input: AssetAssignment, actorId?: string): Promise<ServiceResult<AssetAssignment>> {
  if (!input.asset_id) return fail("Thiếu asset_id.");
  if (!input.assignee_id && !input.department_id) return fail("Cần assignee_id hoặc department_id.");

  try {
    const response = await fetch("/api/assets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "assign", ...input, actorId }) });
    const result = await parse<{ assignment?: AssetAssignment }>(response, "Không cấp phát được tài sản.");
    return result.ok && result.data.assignment ? ok(result.data.assignment) : result.ok ? fail("Không cấp phát được tài sản.") : result;
  } catch (error) {
    return fail(withError(error, "Không cấp phát được tài sản."));
  }
}
