export type TaskLinkInput = { url: string; title: string };
export function normalizeTaskLink(url: unknown, title?: unknown): TaskLinkInput | null;
