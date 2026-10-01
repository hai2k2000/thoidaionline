const excludedNames = new Set([
  "dang quang minh",
  "nguyen van linh",
  "nguyen hong khanh",
]);

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
  return staff?.role_code !== "admin" && !excludedNames.has(normalizeAttendanceName(staff?.full_name));
}

export function isAttendanceListedUser(user) {
  return isAttendanceListedStaff(user);
}

export function roleCodeFromRelation(roles) {
  return Array.isArray(roles) ? roles[0]?.code ?? null : roles?.code ?? null;
}
