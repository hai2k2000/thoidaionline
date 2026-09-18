export function parseArticleUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return { ok: false as const };
  try {
    const url = new URL(value.trim());
    if (!((url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password && url.hostname)) return { ok: false as const };
    return { ok: true as const, value: url.toString() };
  } catch { return { ok: false as const }; }
}

export function parseWithdrawalReason(value: unknown) {
  if (typeof value !== "string") return { ok: false as const };
  const reason = value.normalize("NFC").trim();
  return reason && [...reason].length <= 2000 ? { ok: true as const, value: reason } : { ok: false as const };
}

export function validateMetadataPatch(status: string, patch: Record<string, unknown>) {
  if (["published", "withdrawn"].includes(status) && Object.prototype.hasOwnProperty.call(patch, "plannedPublicationAt")) return { ok: false as const };
  if (status === "scheduled" && Object.prototype.hasOwnProperty.call(patch, "plannedPublicationAt") && !patch.plannedPublicationAt) return { ok: false as const };
  return { ok: true as const };
}
