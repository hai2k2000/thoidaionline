export type ExternalLinkRow = { provider?: "web" | "google_drive"; url: string; label: string };
export function isSafeExternalUrl(value: string, allowHttp?: boolean): boolean;
export function validateExternalLinkRows(rows: ExternalLinkRow[]): Array<{ index: number; message: string }>;
export function buildExternalLinksPayload(rows: ExternalLinkRow[]): Array<{ provider: "web" | "google_drive"; url: string; label: string }>;
