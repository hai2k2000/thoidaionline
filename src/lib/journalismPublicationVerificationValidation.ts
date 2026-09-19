export type PublicationVerificationDecision = "verified" | "rejected";

type ParsedPublicationVerification = {
  decision: PublicationVerificationDecision;
  note: string | null;
  expectedReportUpdatedAt: string;
};

type ParseResult =
  | { ok: true; value: ParsedPublicationVerification }
  | { ok: false };

export function parsePublicationVerification(body: Record<string, unknown> | null): ParseResult {
  if (!body) return { ok: false };
  const allowed = ["decision", "note", "expectedReportUpdatedAt"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) return { ok: false };
  if (body.decision !== "verified" && body.decision !== "rejected") return { ok: false };
  if (typeof body.expectedReportUpdatedAt !== "string" || !body.expectedReportUpdatedAt.trim()) return { ok: false };
  const expected = new Date(body.expectedReportUpdatedAt);
  if (!Number.isFinite(expected.getTime())) return { ok: false };
  if (body.note !== null && body.note !== undefined && typeof body.note !== "string") return { ok: false };
  const note = typeof body.note === "string" ? body.note.normalize("NFC").trim() : null;
  if (note && [...note].length > 5000) return { ok: false };
  if (body.decision === "rejected" && !note) return { ok: false };
  return {
    ok: true,
    value: {
      decision: body.decision,
      note: note || null,
      expectedReportUpdatedAt: expected.toISOString(),
    },
  };
}
