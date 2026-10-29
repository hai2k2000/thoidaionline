export type Scope = "self" | "assigned" | "department" | "all";
export type CatalogPermission = {
    code: string;
    name: string;
    description?: string | null;
};
export type UserRow = {
    id: string;
    full_name: string;
    username?: string | null;
    active: boolean;
    department_id?: string | null;
    department_name?: string | null;
    job_title?: string | null;
    role_code?: string | null;
    role_name?: string | null;
    override_count?: number;
    overrides?: Record<string, {
        effect: "allow" | "deny";
        scope: Scope;
    }>;
    effective?: Record<string, {
        scopes: Scope[];
        source: string;
        roleScopes: Scope[];
    }>;
};
export type PermissionItem = {
    permissionCode: string;
    label?: string;
    roleScopes?: string[];
    structuralScopes?: string[];
    userEffect?: "allow" | "deny" | null;
    userScope?: string | null;
    effectiveScopes?: string[];
    source?: string;
    effectiveDepartment?: {
        name?: string;
    };
    restrictions?: string[];
    grantedBy?: {
        name?: string;
    } | null;
    grantedAt?: string | null;
};
export type PermissionModule = {
    key: string;
    permissions: CatalogPermission[];
};
export type UserPermissionPanelProps = {
    users: UserRow[];
    selectedUserId: string;
    onSelect: (id: string) => void;
    currentUserId?: string;
    onChanged?: (userId: string) => void;
    onToast: (message: string) => void;
    genericModules?: PermissionModule[];
    scopeOptions?: Record<string, Scope[]>;
};

