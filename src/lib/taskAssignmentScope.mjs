const GLOBAL_ASSIGNMENT_ROLES = new Set(["admin", "tong_bien_tap", "pho_tong_bien_tap"]);

export function deriveAssignmentScope(actor, departments) {
  if (["tong_bien_tap", "pho_tong_bien_tap"].includes(actor.roleCode)) {
    const editorialBoard = departments.find((department) => department.code === "leadership") ?? null;
    return {
      kind: "global_default",
      departmentId: editorialBoard?.id ?? null,
      departmentName: editorialBoard?.name ?? null,
      canChooseOtherDepartment: true,
    };
  }
  if (GLOBAL_ASSIGNMENT_ROLES.has(actor.roleCode)) {
    return {
      kind: "global_default",
      departmentId: null,
      departmentName: null,
      canChooseOtherDepartment: true,
    };
  }
  const ownDepartment = departments.find((department) => department.id === actor.departmentId) ?? null;
  return {
    kind: "own_department",
    departmentId: ownDepartment?.id ?? null,
    departmentName: ownDepartment?.name ?? null,
    canChooseOtherDepartment: false,
  };
}
