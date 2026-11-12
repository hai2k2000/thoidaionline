import type { TaskLinkInput } from "./taskLinkPolicy.mjs";
export function uploadBatchTaskLinks(results: { id: string; ordinal?: number }[], cards: { links?: TaskLinkInput[] }[], addLink: (taskId: string, link: TaskLinkInput) => Promise<unknown>): Promise<{ failed: { taskIndex: number; taskId: string; title: string; message: string }[] }>;
export function postTaskLink(taskId: string, link: TaskLinkInput): Promise<void>;
