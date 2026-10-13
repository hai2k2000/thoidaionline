import { supportedScopesForPermission } from "./rbac/permissionScopes.mjs";

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
  roles: { code: string; name: string; active: boolean } | { code: string; name: string; active: boolean }[] | null;
};

export type UserPermissionGrantRow = {
  user_id: string;
  permission_id: string;
  effect?: "allow" | "deny";
  scope?: PermissionMatrixGrantRow["scope"];
};

export type EffectivePermissionSource = "role" | "user_allow" | "user_deny" | "none";
export type OverrideEffect = "inherit" | "allow" | "deny";

export type PermissionMatrixUser = PermissionMatrixUserRow & {
  department_name?: string | null;
  overrides: Record<string, { effect: "allow" | "deny"; scope: PermissionMatrixGrantRow["scope"] }>;
  effective: Record<string, {
    scopes: PermissionMatrixGrantRow["scope"][];
    source: EffectivePermissionSource;
    roleScopes: PermissionMatrixGrantRow["scope"][];
  }>;
};

export type PermissionManagementPayload = {
  permissions: PermissionMatrixPermissionRow[];
  modules: PermissionMatrixModule[];
  roles: PermissionMatrixRole[];
  users: PermissionMatrixUser[];
  scopeOptions: Record<string, PermissionMatrixGrantRow["scope"][]>;
};

export type PermissionUser = {
  id: string;
  username: string | null;
  fullName: string;
  active: boolean;
  roleCode: string;
  roleName: string;
  roleActive: boolean;
  roleGranted: boolean;
  directGranted: boolean;
  effective: boolean;
};

export type QuickReportUserPermission = PermissionUser;

export function getEffectivePermissionSourceLabel(
  entry: Pick<PermissionUser, "active" | "roleActive" | "roleGranted" | "directGranted">,
): string {
  const directEffective = entry.active && entry.directGranted;
  const roleEffective = entry.active && entry.roleActive && entry.roleGranted;
  if (directEffective && roleEffective) return "Có · vai trò + trực tiếp";
  if (roleEffective) return "Có · qua vai trò";
  if (directEffective) return "Có · trực tiếp";
  if (entry.directGranted || entry.roleGranted) return "Không hiệu lực";
  return "—";
}
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

export function buildPermissionUsers(
  users: readonly PermissionMatrixUserRow[],
  permissions: readonly PermissionMatrixPermissionRow[],
  roleGrants: readonly PermissionMatrixGrantRow[],
  userGrants: readonly UserPermissionGrantRow[],
  permissionCode: string,
): PermissionUser[] {
  const permissionId = permissions.find((permission) => permission.code === permissionCode)?.id;
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
    const roleActive = role?.active === true;
    const roleGranted = roleIds.has(user.role_id);
    const directGranted = userIds.has(user.id);
    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      active: user.active,
      roleCode: role?.code ?? "",
      roleName: role?.name ?? "",
      roleActive,
      roleGranted,
      directGranted,
      effective: user.active && (directGranted || (roleActive && roleGranted)),
    };
  });
}

export function buildQuickReportUserPermissions(
  users: readonly PermissionMatrixUserRow[],
  permissions: readonly PermissionMatrixPermissionRow[],
  roleGrants: readonly PermissionMatrixGrantRow[],
  userGrants: readonly UserPermissionGrantRow[],
): QuickReportUserPermission[] {
  return buildPermissionUsers(users, permissions, roleGrants, userGrants, "task.quick_report.create");
}

export function buildPermissionManagementPayload(input: {
  roles: readonly PermissionMatrixRoleRow[];
  permissions: readonly PermissionMatrixPermissionRow[];
  roleGrants: readonly PermissionMatrixGrantRow[];
  users: readonly (PermissionMatrixUserRow & { department_name?: string | null })[];
  userGrants: readonly UserPermissionGrantRow[];
}): PermissionManagementPayload {
  const roles = buildPermissionMatrix(input.roles, input.permissions, input.roleGrants);
  const roleScopesByKey = new Map<string, PermissionMatrixGrantRow["scope"][]>();
  for (const grant of input.roleGrants) {
    const key = `${grant.role_id}:${grant.permission_id}`;
    const scopes = roleScopesByKey.get(key) ?? [];
    if (!scopes.includes(grant.scope)) scopes.push(grant.scope);
    roleScopesByKey.set(key, scopes);
  }
  const permissionById = new Map(input.permissions.map((permission) => [permission.id, permission]));
  const overridesByUser = new Map<string, Record<string, { effect: "allow" | "deny"; scope: PermissionMatrixGrantRow["scope"] }>>();
  for (const grant of input.userGrants) {
    const permission = permissionById.get(grant.permission_id);
    if (!permission || !grant.effect || !grant.scope) continue;
    const overrides = overridesByUser.get(grant.user_id) ?? {};
    overrides[permission.code] = { effect: grant.effect, scope: grant.scope };
    overridesByUser.set(grant.user_id, overrides);
  }
  const roleById = new Map(input.roles.map((role) => [role.id, role]));
  const users = input.users.map((user) => {
    const role = roleById.get(user.role_id);
    const overrides = overridesByUser.get(user.id) ?? {};
    const effective = Object.fromEntries(input.permissions.map((permission) => {
      const roleScopes = roleScopesByKey.get(`${user.role_id}:${permission.id}`) ?? [];
      const override = overrides[permission.code];
      const scopes = !user.active
        ? []
        : override?.effect === "deny"
          ? []
          : override?.effect === "allow"
            ? [override.scope]
            : role?.active === true ? roleScopes : [];
      const source: EffectivePermissionSource = !user.active
        ? "none"
        : override?.effect === "deny"
          ? "user_deny"
          : override?.effect === "allow"
            ? "user_allow"
            : role?.active === true && roleScopes.length > 0 ? "role" : "none";
      return [permission.code, { scopes, source, roleScopes }];
    })) as PermissionMatrixUser["effective"];
    return { ...user, overrides, effective };
  });
  const modules = [...new Set(input.permissions.map((permission) => permission.module))].map((key) => ({
    key,
    permissions: input.permissions.filter((permission) => permission.module === key).map((permission) => ({ ...permission, scopes: [] })),
  }));
  return {
    permissions: [...input.permissions],
    modules,
    roles,
    users,
    scopeOptions: Object.fromEntries(input.permissions.map((permission) => [permission.code, [...supportedScopesForPermission(permission.code)] as PermissionMatrixGrantRow["scope"][]])),
  };
}
