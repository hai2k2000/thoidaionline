const WORKFLOW_LABELS = {
  submit_review: "\u0047\u1eedi duy\u1ec7t h\u1ed3 s\u01a1",
  approve: "Ph\u00ea duy\u1ec7t h\u1ed3 s\u01a1",
  return_for_correction: "Tr\u1ea3 l\u1ea1i ch\u1ec9nh s\u1eeda",
};

export function approvalQueueParams({ q = "", categoryId = "" } = {}) {
  return { q, status: "pending_review", ...(categoryId ? { categoryId } : {}) };
}

export function validateReturnReason(value) {
  const reason = String(value ?? "").trim();
  if (!reason) return "C\u1ea7n nh\u1eadp l\u00fd do tr\u1ea3 l\u1ea1i h\u1ed3 s\u01a1.";
  if (reason.length < 3) return "L\u00fd do tr\u1ea3 l\u1ea1i ph\u1ea3i c\u00f3 \u00edt nh\u1ea5t 3 k\u00fd t\u1ef1.";
  return "";
}

export function workflowErrorMessage(status, code) {
  if (status === 400 || code === "return_reason_required") return "C\u1ea7n nh\u1eadp l\u00fd do tr\u1ea3 l\u1ea1i h\u1ed3 s\u01a1.";
  if (code === "self_approval_forbidden") return "Kh\u00f4ng th\u1ec3 t\u1ef1 ph\u00ea duy\u1ec7t h\u1ed3 s\u01a1 c\u1ee7a m\u00ecnh.";
  if (status === 403 || code === "permission_denied" || code === "forbidden") return "B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n x\u1eed l\u00fd h\u1ed3 s\u01a1 n\u00e0y.";
  if (status === 409 || code === "invalid_transition" || code === "stale_conflict") return "H\u1ed3 s\u01a1 \u0111\u00e3 thay \u0111\u1ed5i tr\u1ea1ng th\u00e1i. H\u00e3y t\u1ea3i l\u1ea1i tr\u01b0\u1edbc khi thao t\u00e1c.";
  return "Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt quy tr\u00ecnh duy\u1ec7t h\u1ed3 s\u01a1.";
}

export function presentWorkflowAction(item) {
  const data = item?.new_data && typeof item.new_data === "object" ? item.new_data : {};
  return {
    label: WORKFLOW_LABELS[item?.action] ?? "Ho\u1ea1t \u0111\u1ed9ng h\u1ed3 s\u01a1",
    reason: typeof data.reason === "string" ? data.reason : "",
  };
}
