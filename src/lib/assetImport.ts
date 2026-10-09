import "server-only";

import { createHash } from "node:crypto";

export type ImportTrackingMode = "individual" | "lot";

export function validateImportQuantity(trackingMode: unknown, quantity: unknown): string | null {
  if (trackingMode !== "individual" && trackingMode !== "lot") return "invalid_tracking_mode";
  if (!Number.isInteger(quantity) || (quantity as number) < 1) return "invalid_quantity";
  if (trackingMode === "individual" && quantity !== 1) return "individual_quantity_must_be_one";
  return null;
}

const normalizeToken = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "D").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();

export function generatedAssetCode(sheetToken: string, sourceRow: number, splitPart = "") {
  const normalizedSheet = normalizeToken(sheetToken);
  const canonicalSheet = ["KO-CO-TREN-SS", "KHONG-CO-TREN-SS", "KHONG-CO-TRONG-SS"].includes(normalizedSheet) ? "KHONG-CO-TRONG-SS" : normalizedSheet || "SOURCE";
  const normalizedSplit = normalizeToken(splitPart);
  const base = `TD-Q3-2026-${canonicalSheet}-R${String(sourceRow).padStart(3, "0")}`;
  return normalizedSplit ? `${base}-S${normalizedSplit}` : base;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

export function sourceHash(fields: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(stableValue(fields))).digest("hex");
}

export function sourceIdentity(importBatchId: string, sourceSheet: string, sourceRow: number, splitPart = "") {
  return `${importBatchId}|${sourceSheet}|${sourceRow}|${splitPart}`;
}
