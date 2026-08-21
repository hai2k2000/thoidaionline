export const LEADERSHIP_ASSIGNMENT_REVIEWER_ROLES = new Set([
  "tong_bien_tap",
  "pho_tong_bien_tap",
  "truong_phong",
  "pho_truong_phong",
  "phu_trach_phong_bien_tap",
  "phu_trach_phong_phong_vien",
  "phu_trach_phong_tri_su",
]);

const DEPARTMENT_ASSIGNMENT_REVIEWER_JOB_TITLES = new Set([
  "truong_phong",
  "pho_truong_phong",
]);

export const isLeadershipAssignmentReviewer = (roleCode) =>
  LEADERSHIP_ASSIGNMENT_REVIEWER_ROLES.has(roleCode?.toLowerCase() ?? "");

export function isEligibleAssignmentReviewer(input) {
  return isLeadershipAssignmentReviewer(input.roleCode)
    || input.isDepartmentManager
    || DEPARTMENT_ASSIGNMENT_REVIEWER_JOB_TITLES.has(input.jobTitleCode?.toLowerCase() ?? "");
}
