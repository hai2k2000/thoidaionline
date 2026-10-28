export function resolveAttendanceAccessFromScopes(scopes) {
  const viewScopes = scopes["attendance.view_all"] ?? [];
  return {
    orgScope: viewScopes.includes("all") ? "all" : viewScopes.includes("department") ? "department" : null,
    canManage: (scopes["attendance.manage"] ?? []).length > 0,
  };
}
