import { canManageAssets, canViewAsset, type AssetVisibilityActor } from "./assetAuthorization.ts";

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T = never>(error: string): ServiceResult<T> => ({ ok: false, error });

export type AssetRepositoryDb = {
  from(table: string): {
    select(columns?: string): unknown;
    insert?(values: unknown): unknown;
    update?(values: unknown): unknown;
  };
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export type AssetRepositoryActor = AssetVisibilityActor & {
  department_id: string | null;
};

export type AssetRepositoryAsset = {
  id: string;
  asset_code?: string | null;
  asset_name: string;
  category: string;
  serial_number?: string | null;
  status?: string | null;
  assigned_department_id?: string | null;
  note?: string | null;
  currentAssignment: AssetRepositoryAssignment | null;
};

export type AssetRepositoryAssignment = {
  id: string;
  asset_id: string;
  assignee_id: string | null;
  department_id: string | null;
  assigned_at?: string | null;
  expected_return_at?: string | null;
  returned_at?: string | null;
  status: string;
  handover_note?: string | null;
  return_note?: string | null;
};

export type AssetListPayload = {
  assets: AssetRepositoryAsset[];
  assignments: AssetRepositoryAssignment[];
};

export type AssetLifecycleInput = {
  asset_id: string;
  department_id?: string | null;
  assignee_id?: string | null;
  expected_return_at?: string | null;
  handover_note?: string | null;
  return_note?: string | null;
  actorId?: string;
};

type QueryResult<T> = { data: T[] | null; error: { message?: string } | null };

const errorText = (error: { message?: string } | null, fallback: string) => error?.message || fallback;

function currentAssignment(assignments: AssetRepositoryAssignment[], assetId: string) {
  return assignments.find((row) => row.asset_id === assetId && row.status === "active" && !row.returned_at) ?? null;
}

export function createAssetRepository(database: AssetRepositoryDb) {
  async function listAssetsForActor(actor: AssetRepositoryActor): Promise<ServiceResult<AssetListPayload>> {
    const [assetResult, assignmentResult] = await Promise.all([
      database.from("assets").select("*") as Promise<QueryResult<AssetRepositoryAsset>>,
      database.from("asset_assignments").select("*") as Promise<QueryResult<AssetRepositoryAssignment>>,
    ]);
    if (assetResult.error || assignmentResult.error) return fail(errorText(assetResult.error || assignmentResult.error, "asset_read_failed"));
    const assignments = assignmentResult.data ?? [];
    const assets = (assetResult.data ?? [])
      .map((asset) => ({ ...asset, currentAssignment: currentAssignment(assignments, asset.id) }))
      .filter((asset) => canViewAsset(actor, asset.currentAssignment));
    const visibleIds = new Set(assets.map((asset) => asset.id));
    return ok({ assets, assignments: assignments.filter((row) => visibleIds.has(row.asset_id)) });
  }

  async function getAssetForActor(actor: AssetRepositoryActor, assetId: string): Promise<ServiceResult<AssetRepositoryAsset>> {
    const result = await listAssetsForActor(actor);
    if (!result.ok) return result;
    const asset = result.data.assets.find((row) => row.id === assetId);
    return asset ? ok(asset) : fail("asset_not_found");
  }

  async function lifecycle(
    actor: AssetRepositoryActor,
    input: AssetLifecycleInput,
    rpcName: string,
    args: Record<string, unknown>,
  ): Promise<ServiceResult<unknown>> {
    if (!canManageAssets(actor)) return fail("forbidden");
    const result = await database.rpc(rpcName, { p_actor_id: actor.id, ...args });
    if (result.error) return fail(errorText(result.error, "asset_lifecycle_failed"));
    return ok(result.data);
  }

  return {
    listAssetsForActor,
    getAssetForActor,
    assignAssetForActor: (actor: AssetRepositoryActor, input: AssetLifecycleInput) => lifecycle(actor, input, "api_asset_assign", {
      p_asset_id: input.asset_id,
      p_department_id: input.department_id,
      p_assignee_id: input.assignee_id ?? null,
      p_expected_return_at: input.expected_return_at ?? null,
      p_handover_note: input.handover_note ?? null,
    }),
    transferAssetForActor: (actor: AssetRepositoryActor, input: AssetLifecycleInput) => lifecycle(actor, input, "api_asset_transfer", {
      p_asset_id: input.asset_id,
      p_department_id: input.department_id,
      p_assignee_id: input.assignee_id ?? null,
      p_expected_return_at: input.expected_return_at ?? null,
      p_handover_note: input.handover_note ?? null,
    }),
    returnAssetForActor: (actor: AssetRepositoryActor, input: AssetLifecycleInput) => lifecycle(actor, input, "api_asset_return", {
      p_asset_id: input.asset_id,
      p_return_note: input.return_note ?? null,
    }),
  };
}
