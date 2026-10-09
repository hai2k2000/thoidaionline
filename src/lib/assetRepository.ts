// @ts-expect-error Node contract tests execute this TypeScript module directly and need the explicit extension.
import { canManageAssets, canViewAsset, type AssetVisibilityActor } from "./assetAuthorization.ts";

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T = never>(error: string): ServiceResult<T> => ({ ok: false, error });

export type AssetRepositoryDb = {
  from(table: string): unknown;
  rpc(name: string, args: Record<string, unknown>): unknown;
};

type AssetRepositoryQuery<T> = {
  select(columns?: string): AssetRepositoryQuery<T>;
  insert(values: unknown): AssetRepositoryQuery<T>;
  update(values: unknown): AssetRepositoryQuery<T>;
  eq(field: string, value: unknown): AssetRepositoryQuery<T>;
  maybeSingle(): PromiseLike<{ data: T | null; error: { message?: string } | null }>;
  single(): PromiseLike<{ data: T | null; error: { message?: string } | null }>;
  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
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
  tracking_mode?: AssetTrackingMode;
  quantity?: number;
  currentAssignment: AssetRepositoryAssignment | null;
  assignmentHistory?: AssetRepositoryAssignment[];
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

export type AssetCreateInput = {
  asset_code?: string | null;
  asset_name: string;
  category: string;
  serial_number?: string | null;
  status?: string | null;
  note?: string | null;
  tracking_mode?: AssetTrackingMode;
  quantity?: number;
};

export type AssetUpdateInput = Partial<AssetCreateInput>;

export type AssetTrackingMode = "individual" | "lot";

export function validateAssetQuantity(trackingMode: unknown, quantity: unknown): string | null {
  if (trackingMode !== "individual" && trackingMode !== "lot") return "invalid_tracking_mode";
  if (!Number.isInteger(quantity) || (quantity as number) < 1) return "invalid_quantity";
  if (trackingMode === "individual" && quantity !== 1) return "individual_quantity_must_be_one";
  return null;
}

type QueryResult<T> = { data: T[] | null; error: { message?: string } | null };

const errorText = (error: { message?: string } | null, fallback: string) => error?.message || fallback;

function currentAssignment(assignments: AssetRepositoryAssignment[], assetId: string) {
  return assignments.find((row) => row.asset_id === assetId && row.status === "active" && !row.returned_at) ?? null;
}

export function createAssetRepository(database: AssetRepositoryDb) {
  const table = <T>(name: string) => database.from(name) as AssetRepositoryQuery<T>;

  async function listAssetsForActor(actor: AssetRepositoryActor): Promise<ServiceResult<AssetListPayload>> {
    const [assetResult, assignmentResult] = await Promise.all([
      table<AssetRepositoryAsset>("assets").select("*"),
      table<AssetRepositoryAssignment>("asset_assignments").select("*"),
    ]);
    if (assetResult.error || assignmentResult.error) return fail(errorText(assetResult.error || assignmentResult.error, "asset_read_failed"));
    const assignments = assignmentResult.data ?? [];
    const assets = (assetResult.data ?? [])
      .map((asset) => ({ ...asset, currentAssignment: currentAssignment(assignments, asset.id), assignmentHistory: assignments.filter((row) => row.asset_id === asset.id) }))
      .filter((asset) => canViewAsset(actor, asset.currentAssignment ? { departmentId: asset.currentAssignment.department_id, assigneeId: asset.currentAssignment.assignee_id } : null));
    const visibleIds = new Set(assets.map((asset) => asset.id));
    return ok({ assets, assignments: assignments.filter((row) => visibleIds.has(row.asset_id)) });
  }

  async function getAssetForActor(actor: AssetRepositoryActor, assetId: string): Promise<ServiceResult<AssetRepositoryAsset>> {
    const result = await listAssetsForActor(actor);
    if (!result.ok) return result;
    const asset = result.data.assets.find((row) => row.id === assetId);
    return asset ? ok(asset) : fail("asset_not_found");
  }

  async function createAssetForActor(actor: AssetRepositoryActor, input: AssetCreateInput): Promise<ServiceResult<AssetRepositoryAsset>> {
    if (!canManageAssets(actor)) return fail("forbidden");
    const trackingMode = input.tracking_mode ?? "individual";
    const quantity = input.quantity ?? 1;
    const quantityError = validateAssetQuantity(trackingMode, quantity);
    if (quantityError) return fail(quantityError);
    const query = table<AssetRepositoryAsset>("assets");
    const result = await query.insert({
      asset_code: input.asset_code || undefined,
      asset_name: input.asset_name.trim(),
      category: input.category.trim(),
      serial_number: input.serial_number || null,
      status: input.status || "available",
      note: input.note || null,
      tracking_mode: trackingMode,
      quantity,
    }).select("*").single();
    if (result.error) return fail(errorText(result.error, "asset_create_failed"));
    if (!result.data) return fail("asset_create_failed");
    return ok({ ...result.data, currentAssignment: null });
  }

  async function updateAssetForActor(actor: AssetRepositoryActor, assetId: string, input: AssetUpdateInput): Promise<ServiceResult<AssetRepositoryAsset>> {
    if (!canManageAssets(actor)) return fail("forbidden");
    if (input.tracking_mode !== undefined || input.quantity !== undefined) {
      const quantityError = input.tracking_mode === undefined && input.quantity !== undefined
        ? (Number.isInteger(input.quantity) && input.quantity >= 1 ? null : "invalid_quantity")
        : validateAssetQuantity(input.tracking_mode ?? "individual", input.quantity ?? 1);
      if (quantityError) return fail(quantityError);
    }
    const query = table<AssetRepositoryAsset>("assets");
    const result = await query.update({ ...input, updated_at: new Date().toISOString() }).eq("id", assetId).select("*").maybeSingle();
    if (result.error) return fail(errorText(result.error, "asset_update_failed"));
    if (!result.data) return fail("asset_not_found");
    return ok({ ...result.data, currentAssignment: null });
  }

  async function lifecycle(
    actor: AssetRepositoryActor,
    input: AssetLifecycleInput,
    rpcName: string,
    args: Record<string, unknown>,
  ): Promise<ServiceResult<unknown>> {
    if (!canManageAssets(actor)) return fail("forbidden");
    const result = await (database.rpc(rpcName, { p_actor_id: actor.id, ...args }) as PromiseLike<{ data: unknown; error: { message?: string } | null }>);
    if (result.error) return fail(errorText(result.error, "asset_lifecycle_failed"));
    return ok(result.data);
  }

  return {
    listAssetsForActor,
    getAssetForActor,
    createAssetForActor,
    updateAssetForActor,
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
