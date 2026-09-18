import { parseArticleUrl, parseWithdrawalReason, validateMetadataPatch } from "./journalismMutationPolicy";

export { parseArticleUrl, parseWithdrawalReason, validateMetadataPatch };

export function asIsoDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export function boundedText(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const text = value.normalize("NFC").trim();
  return [...text].length <= max ? text : undefined;
}
