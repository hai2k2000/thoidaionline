const fileNameOf = (file) => String(file?.name ?? "tệp đính kèm");

const failureMessage = (error) => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return "Tệp đính kèm chưa tải lên được.";
};

const resultRows = (results) => Array.isArray(results) ? results : (Array.isArray(results?.tasks) ? results.tasks : []);

export async function uploadBatchAttachments(results, attachments, uploadTaskAttachment) {
  const rows = resultRows(results);
  const failed = [];
  for (const attachment of attachments ?? []) {
    if (!attachment?.file || !attachment.file.size) continue;
    const taskIndex = Number.isInteger(attachment.taskIndex) ? attachment.taskIndex : -1;
    const row = attachment.taskId
      ? rows.find((item) => item.id === attachment.taskId)
      : rows.find((item) => item.ordinal === taskIndex + 1) ?? rows[taskIndex];
    const taskId = attachment.taskId ?? row?.id ?? "";
    if (!taskId) {
      failed.push({
        taskIndex,
        taskId: "",
        fileName: fileNameOf(attachment.file),
        message: "Không tìm thấy công việc đã tạo để tải tệp lên.",
      });
      continue;
    }
    try {
      const outcome = await uploadTaskAttachment(taskId, attachment.file);
      if (outcome && outcome.ok === false) throw new Error(outcome.message || "Tệp đính kèm chưa tải lên được.");
    } catch (error) {
      failed.push({
        taskIndex,
        taskId,
        fileName: fileNameOf(attachment.file),
        message: failureMessage(error),
      });
    }
  }
  return { failed };
}
