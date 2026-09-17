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
