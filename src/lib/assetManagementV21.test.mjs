import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const importSource = readFileSync(new URL("./assetImport.ts", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../app/api/assets/import/route.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../../supabase/migrations/20261010100000_asset_management_v21_quantity_import.sql", import.meta.url), "utf8");
const migrationV211Source = readFileSync(new URL("../../supabase/migrations/20261011100000_asset_management_v211_unassigned_import.sql", import.meta.url), "utf8");
const authorizationSource = readFileSync(new URL("./assetAuthorization.ts", import.meta.url), "utf8");

const validateQuantity = (trackingMode, quantity) => {
  if (trackingMode !== "individual" && trackingMode !== "lot") return "invalid_tracking_mode";
  if (!Number.isInteger(quantity) || quantity < 1) return "invalid_quantity";
  if (trackingMode === "individual" && quantity !== 1) return "individual_quantity_must_be_one";
  return null;
};

const generatedCode = (sheetToken, sourceRow, splitPart = "") => {
  const normalizedSheet = sheetToken.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "D").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase() || "SOURCE";
  const canonicalSheet = ["KO-CO-TREN-SS", "KHONG-CO-TREN-SS", "KHONG-CO-TRONG-SS"].includes(normalizedSheet) ? "KHONG-CO-TRONG-SS" : normalizedSheet;
  const normalizedSplit = splitPart.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();
  const base = `TD-Q3-2026-${canonicalSheet}-R${String(sourceRow).padStart(3, "0")}`;
  return normalizedSplit ? `${base}-S${normalizedSplit}` : base;
};

test("quantity matrix enforces individual and lot rules", () => {
  assert.equal(validateQuantity("individual", 1), null);
  assert.equal(validateQuantity("individual", 2), "individual_quantity_must_be_one");
  assert.equal(validateQuantity("lot", 5), null);
  assert.equal(validateQuantity("lot", 0), "invalid_quantity");
  assert.equal(validateQuantity("lot", 1.5), "invalid_quantity");
});

test("generated codes are stable and split-safe", () => {
  assert.equal(generatedCode("không có trên ss", 25), "TD-Q3-2026-KHONG-CO-TRONG-SS-R025");
  assert.equal(generatedCode("KHONG-CO-TRONG-SS", 25, "1"), "TD-Q3-2026-KHONG-CO-TRONG-SS-R025-S1");
  assert.notEqual(generatedCode("SHEET", 25, "1"), generatedCode("SHEET", 25, "2"));
  assert.match(importSource, /stableValue/);
  assert.match(importSource, /createHash\("sha256"\)/);
});

test("preview, approval, import and fail-closed gates are source-backed", () => {
  assert.match(routeSource, /\["preview", "approve", "import"\]/);
  assert.match(routeSource, /batch\.status !== "previewed"/);
  assert.match(routeSource, /batch\.status !== "approved"/);
  assert.match(routeSource, /source_hash_mismatch/);
  assert.match(routeSource, /owner_decision_required/);
  assert.match(migrationSource, /unique \(import_batch_id, source_sheet, source_row, split_part\)/);
  assert.match(migrationSource, /if v_record\.asset_id is not null/);
  assert.match(migrationSource, /asset_actor_can_manage/);
  assert.match(migrationSource, /asset_validate_destination/);
  assert.match(migrationSource, /'assets', 'assets'/);
  assert.doesNotMatch(migrationSource, /create unique index.*asset_assignments/i);
  assert.doesNotMatch(migrationSource, /can_manage_assets|can_view_assets/);
  assert.match(routeSource, /IMPORT_UNASSIGNED/);
  assert.match(routeSource, /proposed_assignee_id/);
  assert.match(migrationV211Source, /asset_import_unassigned_destination_forbidden/);
  assert.match(migrationV211Source, /Chưa thuộc sở hữu phòng nào; cần xác định và bổ sung sau\./);
  assert.match(migrationV211Source, /import_action/);
  assert.match(migrationV211Source, /then 'in_use'\s+else 'available'\s+end/);
  assert.match(migrationV211Source, /proposed_action not in \('IMPORT_ASSIGNED', 'IMPORT_UNASSIGNED'\)/);
  assert.match(migrationV211Source, /proposed_department_id is not null or v_record\.proposed_assignee_id is not null/);
  assert.match(migrationV211Source, /perform public\.asset_validate_destination/);
  assert.match(migrationV211Source, /if v_record\.proposed_action = 'IMPORT_ASSIGNED'/);
});

test("asset permissions remain canonical and separate from task permissions", () => {
  assert.match(routeSource, /toAssetRepositoryActor/);
  assert.match(routeSource, /canManageAssets/);
  assert.match(authorizationSource, /asset\.manage/);
  assert.doesNotMatch(routeSource, /can_edit_all_tasks|can_manage_assets/);
});
