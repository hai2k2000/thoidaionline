import type { JournalismPublicationReportDto } from "./taskContracts";

type ParsedManualPublicationReport = {
  publicationUrl: string;
  publishedTitle: string | null;
  publishedAt: string;
  note: string | null;
  expectedUpdatedAt: string | null;
};

type ParseResult =
  | { ok: true; value: ParsedManualPublicationReport }
  | { ok: false };

const ISO_DATE = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
};

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

export function parseManualPublicationReport(body: Record<string, unknown> | null): ParseResult {
  if (!body) return { ok: false };
  const allowed = ["publicationUrl", "publishedTitle", "publishedAt", "note", "expectedUpdatedAt"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) return { ok: false };
  const publicationUrl = httpUrl(body.publicationUrl);
  const publishedAt = ISO_DATE(body.publishedAt);
  const publishedTitle = bounded(body.publishedTitle, 500);
  const note = bounded(body.note, 5000);
  const expectedUpdatedAt = body.expectedUpdatedAt === null || body.expectedUpdatedAt === undefined
    ? null
    : ISO_DATE(body.expectedUpdatedAt);
  if (!publicationUrl || !publishedAt || publishedTitle === undefined || note === undefined || expectedUpdatedAt === undefined) return { ok: false };
  return { ok: true, value: { publicationUrl, publishedTitle, publishedAt, note, expectedUpdatedAt } };
}

export function publicationReportDto(value: unknown): JournalismPublicationReportDto | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const reporter = row.reporter && typeof row.reporter === "object"
    ? row.reporter as { full_name?: string | null }
    : null;
  if (typeof row.id !== "string" || typeof row.task_id !== "string" || typeof row.publication_url !== "string"
    || typeof row.published_at !== "string" || typeof row.reported_by !== "string"
    || typeof row.created_at !== "string" || typeof row.updated_at !== "string") return null;
  return {
    id: row.id,
    task_id: row.task_id,
    publication_url: row.publication_url,
    published_title: typeof row.published_title === "string" ? row.published_title : null,
    published_at: row.published_at,
    note: typeof row.note === "string" ? row.note : null,
    reported_by: row.reported_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    reporter: reporter ? { full_name: reporter.full_name ?? null } : null,
  };
}
