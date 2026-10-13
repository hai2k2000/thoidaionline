const allScopes = ["self", "assigned", "department", "all"];

/** @param {string} code */
export function supportedScopesForPermission(code) {
  if (["task.quick_report.create", "attendance.view_self", "leave.view_self", "schedule.view_self"].includes(code)) return ["self", "all"];
  if (["task.create", "task.edit_all", "task.review", "task.score", "task.evaluate.step1", "task.evaluate.step2", "staff.manage", "permission.manage", "evaluation.rubric.manage", "attendance.view_all", "asset.manage", "journalism.metadata.update", "journalism.publication.manage", "journalism.publication.verify"].includes(code)) return ["all"];
  if (code === "task.assign") return ["department", "all"];
  if (code === "asset.view") return ["assigned", "department", "all"];
  return allScopes;
}
