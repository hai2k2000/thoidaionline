export const LEADERSHIP_ASSIGNMENT_REVIEWER_ROLES: Set<string>;
export function isLeadershipAssignmentReviewer(roleCode: string | null | undefined): boolean;
export function isEligibleAssignmentReviewer(input: {
  roleCode?: string | null;
  jobTitleCode?: string | null;
  isDepartmentManager: boolean;
}): boolean;
