import { normalizeTaskLink } from "./taskLinkPolicy.mjs";

export async function uploadBatchTaskLinks(results, cards, addLink) {
  const failed = [];
  for (const [taskIndex, card] of cards.entries()) {
    const task = results.find(row => row.ordinal === taskIndex + 1) ?? results[taskIndex];
    for (const draft of card.links ?? []) {
      try {
        const link = normalizeTaskLink(draft.url, draft.title);
        if (!link) throw new Error("Liên kết không hợp lệ.");
        if (!task?.id) throw new Error("Không tìm thấy công việc đã tạo để thêm liên kết.");
        await addLink(task.id, link);
      } catch (cause) {
        failed.push({ taskIndex, taskId: task?.id ?? "", title: draft.title || draft.url, message: cause instanceof Error ? cause.message : "Không thể thêm liên kết." });
      }
    }
  }
  return { failed };
}

export async function postTaskLink(taskId, link) {
  const response = await fetch(`/api/tasks/${taskId}/links`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(link) });
  if (!response.ok) throw new Error(`Không thể thêm liên kết “${link.title}” (${response.status}).`);
}
