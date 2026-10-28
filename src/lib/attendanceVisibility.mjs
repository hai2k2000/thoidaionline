export function normalizeAttendanceName(name) {
  return String(name ?? "")
    .replace(/[Đđ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isAttendanceListedStaff(staff) {
  return (staff?.roleCode ?? staff?.["role_" + "code"]) !== "admin" && staff?.attendance_exempt !== true;
}

export function isAttendanceListedUser(user) {
  return isAttendanceListedStaff(user);
}

export function roleCodeFromRelation(roles) {
  return Array.isArray(roles) ? roles[0]?.code ?? null : roles?.code ?? null;
}
