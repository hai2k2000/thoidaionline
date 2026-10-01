export type PermissionMatrixRoleRow = {
  id: string;
  code: string;
  name: string;
  level: number;
  active: boolean;
};

export type PermissionMatrixPermissionRow = {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
};

export type PermissionMatrixGrantRow = {
  role_id: string;
  permission_id: string;
  scope: "self" | "assigned" | "department" | "all";
};

export type PermissionMatrixPermission = PermissionMatrixPermissionRow & {
  scopes: PermissionMatrixGrantRow["scope"][];
};

export type PermissionMatrixModule = {
  key: string;
  permissions: PermissionMatrixPermission[];
};

export type PermissionMatrixRole = PermissionMatrixRoleRow & {
  modules: PermissionMatrixModule[];
};

export type PermissionMatrixUserRow = {
  id: string;
  username: string | null;
  full_name: string;
  active: boolean;
  role_id: string;
  roles: { code: string; name: string } | { code: string; name: string }[] | null;
};

export type UserPermissionGrantRow = {
  user_id: string;
  permission_id: string;
};

export type QuickReportUserPermission = {
  id: string;
  username: string | null;
  fullName: string;
  active: boolean;
  roleCode: string;
  roleName: string;
  roleGranted: boolean;
  directGranted: boolean;
  effective: boolean;
};

export function buildPermissionMatrix(
  roles: readonly PermissionMatrixRoleRow[],
  permissions: readonly PermissionMatrixPermissionRow[],
  grants: readonly PermissionMatrixGrantRow[],
): PermissionMatrixRole[] {
  const grantsByRoleAndPermission = new Map<string, PermissionMatrixGrantRow["scope"][]>();
  for (const grant of grants) {
    const key = `${grant.role_id}:${grant.permission_id}`;
    const scopes = grantsByRoleAndPermission.get(key) ?? [];
    if (!scopes.includes(grant.scope)) scopes.push(grant.scope);
    grantsByRoleAndPermission.set(key, scopes);
  }

  const moduleKeys = [...new Set(permissions.map((permission) => permission.module))];
  return roles.map((role) => ({
    ...role,
    modules: moduleKeys.map((moduleKey) => ({
      key: moduleKey,
      permissions: permissions
        .filter((permission) => permission.module === moduleKey)
        .map((permission) => ({
          ...permission,
          scopes: grantsByRoleAndPermission.get(`${role.id}:${permission.id}`) ?? [],
        })),
    })),
  }));
}

export function buildQuickReportUserPermissions(
  users: readonly PermissionMatrixUserRow[],
  permissions: readonly PermissionMatrixPermissionRow[],
  roleGrants: readonly PermissionMatrixGrantRow[],
  userGrants: readonly UserPermissionGrantRow[],
): QuickReportUserPermission[] {
  const permissionId = permissions.find((permission) => permission.code === "task.quick_report.create")?.id;
  const roleIds = new Set(
    roleGrants
      .filter((grant) => grant.permission_id === permissionId)
      .map((grant) => grant.role_id),
  );
  const userIds = new Set(
    userGrants
      .filter((grant) => grant.permission_id === permissionId)
      .map((grant) => grant.user_id),
  );
  return users.map((user) => {
    const role = Array.isArray(user.roles) ? user.roles[0] : user.roles;
    const roleGranted = roleIds.has(user.role_id);
    const directGranted = userIds.has(user.id);
    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      active: user.active,
      roleCode: role?.code ?? "",
      roleName: role?.name ?? "",
      roleGranted,
      directGranted,
      effective: roleGranted || directGranted,
    };
  });
}
