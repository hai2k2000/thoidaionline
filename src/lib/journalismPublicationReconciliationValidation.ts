type ParsedManualPublicationReconciliation = {
  publicationUrl: string;
  publishedTitle: string | null;
  publishedAt: string;
  note: string | null;
  expectedUpdatedAt: string;
  reason: string;
};

type ParseResult =
  | { ok: true; value: ParsedManualPublicationReconciliation }
  | { ok: false };

function bounded(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const result = value.normalize("NFC").trim();
  return [...result].length <= max ? (result || null) : undefined;
}

function httpUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  const result = value.trim();
  if (!result || result.length > 2048) return undefined;
  try {
    const parsed = new URL(result);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) return undefined;
    return result;
  } catch {
    return undefined;
  }
}

function isoDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export function parseManualPublicationReconciliation(body: Record<string, unknown> | null): ParseResult {
  if (!body) return { ok: false };
  const allowed = ["publicationUrl", "publishedTitle", "publishedAt", "note", "expectedUpdatedAt", "reason"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) return { ok: false };
  const publicationUrl = httpUrl(body.publicationUrl);
  const publishedAt = isoDate(body.publishedAt);
  const publishedTitle = bounded(body.publishedTitle, 500);
  const note = bounded(body.note, 5000);
  const expectedUpdatedAt = isoDate(body.expectedUpdatedAt);
  const reason = bounded(body.reason, 2000);
  if (!publicationUrl || !publishedAt || !expectedUpdatedAt || publishedTitle === undefined || note === undefined || !reason) return { ok: false };
  return { ok: true, value: { publicationUrl, publishedTitle, publishedAt, note, expectedUpdatedAt, reason } };
}
