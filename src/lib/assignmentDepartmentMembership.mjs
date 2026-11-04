/** Preserve the real department while adding the editorial-board assignment membership. */
export function assignmentMemberDepartmentIds({ departmentId, roleCode, jobTitleCode, leadershipDepartmentId }) {
  const ids = departmentId ? [departmentId] : [];
  if (leadershipDepartmentId && (roleCode === "pho_tong_bien_tap" || jobTitleCode === "truong_phong")) ids.push(leadershipDepartmentId);
  return [...new Set(ids)];
}
