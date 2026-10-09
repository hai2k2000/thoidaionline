import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { toAssetRepositoryActor } from "@/lib/assetApiActor";
import { canManageAssets } from "@/lib/assetAuthorization";
import { generatedAssetCode, sourceHash, sourceIdentity, validateImportQuantity } from "@/lib/assetImport";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: NO_STORE });

type ImportRecordInput = {
  source_sheet: string;
  source_row: number;
  split_part?: string;
  source_asset_code?: string | null;
  proposed_asset_code?: string;
  raw_asset_name: string;
  raw_category: string;
  tracking_mode: "individual" | "lot";
  book_quantity: number;
  counted_quantity: number;
  proposed_quantity: number;
  raw_department_text?: string | null;
  proposed_department_id?: string | null;
  raw_custodian_text?: string | null;
  proposed_assignee_id?: string | null;
  validation_status?: "review_required" | "valid" | "approved" | "blocked";
  warning?: string | null;
  owner_decision_required?: boolean;
  proposed_action: string;
  raw_json?: Record<string, unknown>;
};

function normalizeRecord(batchId: string, row: ImportRecordInput) {
  const splitPart = row.split_part ?? "";
  const quantityError = validateImportQuantity(row.tracking_mode, row.proposed_quantity);
  if (!row.source_sheet || !Number.isInteger(row.source_row) || row.source_row < 1 || !row.raw_asset_name?.trim() || !row.raw_category?.trim()) return { error: "invalid_import_record" as const };
  const sourceFields = { ...row, split_part: splitPart };
  const proposedCode = row.proposed_asset_code?.trim() || row.source_asset_code?.trim() || generatedAssetCode(row.source_sheet, row.source_row, splitPart);
  return {
    value: {
      import_batch_id: batchId,
      source_sheet: row.source_sheet.trim(),
      source_row: row.source_row,
      split_part: splitPart,
      source_key: sourceIdentity(batchId, row.source_sheet.trim(), row.source_row, splitPart),
      source_hash: sourceHash(sourceFields),
      source_asset_code: row.source_asset_code?.trim() || null,
      proposed_asset_code: proposedCode,
      raw_asset_name: row.raw_asset_name.trim(),
      raw_category: row.raw_category.trim(),
      tracking_mode: row.tracking_mode,
      book_quantity: row.book_quantity,
      counted_quantity: row.counted_quantity,
      quantity_difference: row.counted_quantity - row.book_quantity,
      proposed_quantity: row.proposed_quantity,
      raw_department_text: row.raw_department_text?.trim() || null,
      proposed_department_id: row.proposed_department_id || null,
      raw_custodian_text: row.raw_custodian_text?.trim() || null,
      proposed_assignee_id: row.proposed_assignee_id || null,
      validation_status: quantityError ? "blocked" : (row.validation_status ?? "review_required"),
      warning: [row.warning, quantityError].filter(Boolean).join(" | ") || null,
      owner_decision_required: row.owner_decision_required ?? true,
      proposed_action: row.proposed_action.trim(),
      raw_json: row.raw_json ?? sourceFields,
    },
  };
}

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const sessionActor = await getSessionUser();
  if (!sessionActor) return json({ error: "forbidden" }, { status: 403 });
  const actor = toAssetRepositoryActor(sessionActor);
  if (!canManageAssets(actor)) return json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string; batch?: Record<string, unknown>; records?: ImportRecordInput[]; source_file_hash?: string } | null;
  const action = body?.action;
  if (!action || !["preview", "approve", "import"].includes(action)) return json({ error: "invalid_action" }, { status: 400 });

  if (action === "preview") {
    const batch = body?.batch;
    const batchKey = typeof batch?.batch_key === "string" ? batch.batch_key.trim() : "";
    const sourceFileName = typeof batch?.source_file_name === "string" ? batch.source_file_name.trim() : "";
    if (!batchKey || !sourceFileName || !Array.isArray(body?.records) || body.records.length < 1 || body.records.length > 500 || body.records.some((record) => !record || typeof record !== "object")) return json({ error: "invalid_preview" }, { status: 400 });
    const { data: existing } = await serverSupabase.from("asset_import_batches").select("id,status").eq("batch_key", batchKey).maybeSingle();
    if (existing && !["draft", "previewed"].includes(existing.status)) return json({ error: "batch_not_mutable" }, { status: 409 });
    let batchId = existing?.id;
    if (!batchId) {
      const created = await serverSupabase.from("asset_import_batches").insert({ batch_key: batchKey, source_file_name: sourceFileName, source_period: typeof batch?.source_period === "string" ? batch.source_period : null, source_file_hash: typeof batch?.source_file_hash === "string" ? batch.source_file_hash : null, preview_metadata: batch?.preview_metadata ?? {}, status: "draft", created_by: actor.id }).select("id").single();
      if (created.error || !created.data) return json({ error: "preview_batch_create_failed" }, { status: 400 });
      batchId = created.data.id;
    } else {
      const updated = await serverSupabase.from("asset_import_batches").update({ source_file_name: sourceFileName, source_period: typeof batch?.source_period === "string" ? batch.source_period : null, source_file_hash: typeof batch?.source_file_hash === "string" ? batch.source_file_hash : null, preview_metadata: batch?.preview_metadata ?? {}, status: "draft", updated_at: new Date().toISOString() }).eq("id", batchId).select("id").single();
      if (updated.error) return json({ error: "preview_batch_update_failed" }, { status: 400 });
      const deleted = await serverSupabase.from("asset_import_records").delete().eq("import_batch_id", batchId);
      if (deleted.error) return json({ error: "preview_record_reset_failed" }, { status: 400 });
    }
    const normalized = body.records.map((record) => normalizeRecord(batchId!, record));
    const invalid = normalized.find((record) => "error" in record);
    if (invalid) return json({ error: invalid.error }, { status: 400 });
    const values = normalized.filter((record): record is Extract<(typeof normalized)[number], { value: unknown }> => "value" in record).map((record) => record.value);
    if (values.length !== normalized.length) return json({ error: "invalid_import_record" }, { status: 400 });
    const inserted = await serverSupabase.from("asset_import_records").insert(values);
    if (inserted.error) return json({ error: "preview_record_create_failed" }, { status: 400 });
    const marked = await serverSupabase.from("asset_import_batches").update({ status: "previewed", updated_at: new Date().toISOString() }).eq("id", batchId);
    if (marked.error) return json({ error: "preview_batch_finalize_failed" }, { status: 400 });
    return json({ batch_id: batchId, record_count: body.records.length }, { status: 201 });
  }

  const batchId = typeof body?.batch?.id === "string" ? body.batch.id : typeof body?.batch?.batch_id === "string" ? body.batch.batch_id : "";
  if (!batchId) return json({ error: "batch_id_required" }, { status: 400 });
  const { data: batch, error: batchError } = await serverSupabase.from("asset_import_batches").select("*").eq("id", batchId).maybeSingle();
  if (batchError || !batch) return json({ error: "batch_not_found" }, { status: 404 });

  if (action === "approve") {
    if (batch.status !== "previewed") return json({ error: "batch_not_previewed" }, { status: 409 });
    const { data: records, error } = await serverSupabase.from("asset_import_records").select("validation_status,owner_decision_required,proposed_department_id,proposed_quantity,tracking_mode").eq("import_batch_id", batchId);
    if (error || !records?.length) return json({ error: "batch_records_missing" }, { status: 400 });
    const unresolved = records.some((record) => record.owner_decision_required || !["valid", "approved"].includes(record.validation_status) || (record.tracking_mode === "individual" && record.proposed_quantity !== 1) || record.proposed_quantity < 1);
    if (unresolved) return json({ error: "owner_decision_required" }, { status: 409 });
    await serverSupabase.from("asset_import_records").update({ validation_status: "approved", updated_at: new Date().toISOString() }).eq("import_batch_id", batchId);
    await serverSupabase.from("asset_import_batches").update({ status: "approved", approved_by: actor.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", batchId);
    return json({ batch_id: batchId, status: "approved" });
  }

  if (batch.status !== "approved") return json({ error: "batch_not_approved" }, { status: 409 });
  const providedHash = typeof body?.source_file_hash === "string" ? body.source_file_hash : "";
  if ((batch.source_file_hash ?? "") !== providedHash) return json({ error: "source_hash_mismatch" }, { status: 409 });
  const result = await serverSupabase.rpc("api_import_asset_batch", { p_actor_id: actor.id, p_batch_id: batchId, p_source_file_hash: providedHash });
  if (result.error) return json({ error: result.error.message === "asset_import_source_hash_mismatch" ? "source_hash_mismatch" : "import_failed" }, { status: 409 });
  return json({ batch_id: batchId, status: "imported", result: result.data });
}
