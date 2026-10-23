export function classifyWorkflowRpcError(error) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  if (code === "42501") return /self approval/i.test(message) ? "self_approval_forbidden" : "permission_denied";
  if (code === "P0002") return "record_not_found";
  if (code === "40001") return "stale_conflict";
  if (code === "22023") return /reason/i.test(message) ? "return_reason_required" : "invalid_transition";
  return "workflow_failed";
}

export function workflowHttpStatus(code) {
  return {
    permission_denied: 403,
    self_approval_forbidden: 403,
    record_not_found: 404,
    return_reason_required: 400,
    invalid_action: 400,
    invalid_transition: 409,
    stale_conflict: 409,
  }[code] ?? 500;
}
