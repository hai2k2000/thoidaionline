export type AssignmentSelectionPerson = { id: string; departmentId: string | null; roleCode?: string | null; canReview: boolean; canReviewOutsideDepartment: boolean };
export type AssignmentSelectionInput = {
  broad: boolean;
  actorRoleCode?: string;
  actorDepartmentId: string | null;
  department: { id: string; managerId: string | null } | null;
  people: AssignmentSelectionPerson[];
  departmentId: string;
  assigneeId: string;
  reviewerId: string;
  collaboratorIds: string[];
  watcherIds: string[];
  groupDepartmentId: string | null;
  excludedMemberIds: string[];
};

export function resolveAssignmentSelection(input: AssignmentSelectionInput) {
  if (!input.department || input.department.id !== input.departmentId || !input.department.managerId) return { ok: false as const };
  if (!input.broad && input.actorDepartmentId !== input.departmentId) return { ok: false as const };
  const allowedPeople = input.broad ? input.people : input.people.filter((person) => person.departmentId === input.actorDepartmentId || person.canReviewOutsideDepartment);
  const visible = new Map(allowedPeople.map((person) => [person.id, person]));
  const members = allowedPeople.filter((person) => person.departmentId === input.departmentId);
  const memberIds = new Set(members.map((person) => person.id));
  const assignee = visible.get(input.assigneeId);
  const reviewer = visible.get(input.reviewerId);
  if (!visible.has(input.department.managerId) || !assignee
    || assignee.departmentId !== input.departmentId || !reviewer
    || !reviewer.canReview
    || (!reviewer.canReviewOutsideDepartment && reviewer.departmentId !== input.departmentId)) return { ok: false as const };
  if (input.actorRoleCode === "pho_tong_bien_tap" && assignee.roleCode === "tong_bien_tap") return { ok: false as const };
  if (input.groupDepartmentId !== null && input.groupDepartmentId !== input.departmentId) return { ok: false as const };
  if (input.groupDepartmentId === null && input.excludedMemberIds.length) return { ok: false as const };
  if (input.collaboratorIds.some((id) => !memberIds.has(id))) return { ok: false as const };
  if (input.watcherIds.some((id) => !visible.has(id))) return { ok: false as const };
  const excluded = new Set(input.excludedMemberIds);
  if ([...excluded].some((id) => !memberIds.has(id)) || excluded.has(input.assigneeId) || excluded.has(input.department.managerId)) return { ok: false as const };
  const expanded = input.groupDepartmentId
    ? members.map((person) => person.id).filter((id) => !excluded.has(id))
    : [];
  const collaboratorIds = [...new Set([...expanded, ...input.collaboratorIds])]
    .filter((id) => id !== input.assigneeId && id !== input.department?.managerId);
  if (input.groupDepartmentId && collaboratorIds.length === 0) return { ok: false as const };
  const collaboratorSet = new Set(collaboratorIds);
  const watcherIds = [...new Set(input.watcherIds)]
    .filter((id) => id !== input.assigneeId && !collaboratorSet.has(id));
  return { ok: true as const, collaboratorIds, watcherIds };
}
