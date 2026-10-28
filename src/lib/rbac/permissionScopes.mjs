const allScopes = ["self", "assigned", "department", "all"];

/** @param {string} code */
export function supportedScopesForPermission(code) {
  if (["leave.approve", "schedule.business.approve", "schedule.event.approve"].includes(code)) return ["department", "all"];
  if (["task.quick_report.create", "attendance.view_self", "leave.view_self", "schedule.view_self", "record.self_approve"].includes(code)) return ["self", "all"];
  if (code === "attendance.view_all") return ["department", "all"];
  if (["task.create", "task.edit_all", "task.review", "task.score", "task.evaluate.step1", "task.evaluate.step2", "staff.manage", "permission.manage", "evaluation.rubric.manage", "attendance.manage", "asset.manage", "journalism.metadata.update", "journalism.publication.manage", "journalism.publication.verify", "record.create", "record.edit", "record.approve", "record.delete", "record.restore", "record.export", "record.acl.manage"].includes(code)) return ["all"];
  if (code === "task.assign") return ["department", "all"];
  if (code === "asset.view") return ["assigned", "department", "all"];
  return allScopes;
}
