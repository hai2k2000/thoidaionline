export function normalizeAttendanceName(name) {
  return String(name ?? "")
    .replace(/[Đđ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const ATTENDANCE_EXEMPT_JOB_TITLE_CODES = new Set(["ctv"]);

export function isAttendanceListedStaff(staff) {
  const jobTitle = Array.isArray(staff?.job_titles) ? staff.job_titles[0] : staff?.job_titles;
  const jobTitleCode = String(staff?.jobTitleCode ?? staff?.job_title_code ?? jobTitle?.code ?? "").trim().toLowerCase();
  return (staff?.roleCode ?? staff?.["role_" + "code"]) !== "admin"
    && staff?.attendance_exempt !== true
    && !ATTENDANCE_EXEMPT_JOB_TITLE_CODES.has(jobTitleCode);
}

export function isAttendanceListedUser(user) {
  return isAttendanceListedStaff(user);
}

export function roleCodeFromRelation(roles) {
  return Array.isArray(roles) ? roles[0]?.code ?? null : roles?.code ?? null;
}
