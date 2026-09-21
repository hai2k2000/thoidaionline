const STATUSES = new Set(["not_published", "scheduled", "published", "withdrawn"]);

export function parseArticleUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return { ok: false };
  try {
    const url = new URL(value.trim());
    return {
      ok: (url.protocol === "http:" || url.protocol === "https:")
        && !url.username && !url.password && Boolean(url.hostname),
      value: url.toString(),
    };
  } catch {
    return { ok: false };
  }
}

export function parseWithdrawalReason(value) {
  if (typeof value !== "string") return { ok: false };
  const reason = value.normalize("NFC").trim();
  return reason.length > 0 && [...reason].length <= 2000
    ? { ok: true, value: reason }
    : { ok: false };
}

export function validateMetadataPatch(status, patch) {
  if (!STATUSES.has(status)) return { ok: false, code: "invalid_request" };
  if (Object.prototype.hasOwnProperty.call(patch, "articleUrl")
    || Object.prototype.hasOwnProperty.call(patch, "publicationStatus")
    || Object.prototype.hasOwnProperty.call(patch, "publishedAt")) {
    return { ok: false, code: "invalid_request" };
  }
  if (Object.prototype.hasOwnProperty.call(patch, "plannedPublicationAt")
    && (status === "published" || status === "withdrawn")) {
    return { ok: false, code: "publication_plan_locked" };
  }
  if (status === "scheduled"
    && Object.prototype.hasOwnProperty.call(patch, "plannedPublicationAt")
    && !patch.plannedPublicationAt) {
    return { ok: false, code: "planned_publication_required" };
  }
  return { ok: true };
}

export function transitionPublication(current, request) {
  const from = current.status;
  const to = request.status;
  const allowed = (from === "not_published" && ["scheduled", "published"].includes(to))
    || (from === "scheduled" && ["not_published", "published"].includes(to))
    || (from === "published" && to === "withdrawn");
  if (!allowed) return { ok: false, code: "publication_state_conflict" };
  if (["not_published", "scheduled"].includes(to)) {
    if (to === "scheduled" && !request.plannedPublicationAt) return { ok: false, code: "planned_publication_required" };
    if (to === "not_published") return { ok: true, value: { ...current, status: to, plannedPublicationAt: null, publishedAt: null, articleUrl: null } };
  }
  if (to === "published") {
    const url = parseArticleUrl(request.articleUrl);
    if (!url.ok) return { ok: false, code: "invalid_article_url" };
    return { ok: true, value: { ...current, status: to, publishedAt: "SERVER_NOW", articleUrl: url.value } };
  }
  if (to === "withdrawn") {
    const reason = parseWithdrawalReason(request.reason);
    if (!reason.ok) return { ok: false, code: "withdrawal_reason_required" };
    return { ok: true, value: { ...current, status: to, withdrawalReason: reason.value } };
  }
  return { ok: false, code: "publication_state_conflict" };
}
