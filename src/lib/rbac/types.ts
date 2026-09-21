export type RbacScope = "self" | "assigned" | "department" | "all";

export type RbacGrant = {
  permissionCode: string;
  scope: RbacScope;
};

export type RbacActor = {
  id: string;
  departmentId: string | null;
  grants: readonly RbacGrant[];
};

export type RbacTaskResource = {
  kind: "task";
  id: string;
  departmentId: string | null;
  createdBy: string | null;
  ownerId: string | null;
  assigneeId: string | null;
  reviewerId: string | null;
  participantIds?: readonly string[];
};

export type RbacResource = RbacTaskResource;
