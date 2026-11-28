export function approvalSelection(rows, approvableIds, status = "") {
  if (status && status !== "pending_review") return [];
  const allowed = new Set(approvableIds);
  return rows.filter((row) => row.status === "pending_review" && allowed.has(row.id));
}

export async function runBulkApproval(items, { getRecord, approve, onProgress }) {
  const result = { succeeded: [], skipped: [], failed: [] };
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    onProgress?.(index + 1, items.length);
    try {
      const detail = await getRecord(item.id);
      const current = detail?.record?.record;
      if (!current || typeof current.status !== "string" || typeof current.updated_at !== "string") throw new Error("Không thể tải hồ sơ để kiểm tra.");
      if (current?.status !== "pending_review") { result.skipped.push({ item, reason: "không còn ở trạng thái chờ duyệt" }); continue; }
      if (current.updated_at !== item.updated_at) { result.skipped.push({ item, reason: "vừa được sửa, vui lòng xem lại" }); continue; }
      const response = await approve(item.id);
      if (!response.ok) throw new Error(response.error ?? "Không thể duyệt hồ sơ");
      result.succeeded.push(item);
    } catch (error) { result.failed.push({ item, reason: error instanceof Error ? error.message : "Không thể duyệt hồ sơ" }); }
  }
  return result;
}

export function summarizeApproval(result) { return { count: result.succeeded.length, issues: [...result.skipped, ...result.failed].map(({ item, reason }) => ({ code: item.record_code, reason })) }; }

export function createApprovalRunner() {
  let running = false;
  return async (operation) => {
    if (running) return null;
    running = true;
    try { return await operation(); } finally { running = false; }
  };
}
