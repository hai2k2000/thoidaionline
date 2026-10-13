export type RbacScope = "self" | "assigned" | "department" | "all";

export type RbacGrantEffect = "allow" | "deny";

export type EffectivePermissionSource = "role" | "user_allow" | "user_deny" | "none";

export type RbacGrant = {
  permissionCode: string;
  scope: RbacScope;
};

export type EffectivePermission = {
  permissionCode: string;
  roleScopes: RbacScope[];
  userEffect: RbacGrantEffect | null;
  userScope: RbacScope | null;
  effectiveScopes: RbacScope[];
  source: EffectivePermissionSource;
};

export type RbacActor = {
  id: string;
  departmentId: string | null;
  grants: readonly RbacGrant[];
  permissions?: readonly EffectivePermission[];
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
