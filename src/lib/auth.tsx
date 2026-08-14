"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getRoleAccessPolicy } from "@/components/appNavState";
import { supabase } from "@/lib/supabase";

type PermissionKey =
  | "can_manage_users"
  | "can_manage_permissions"
  | "can_create_task"
  | "can_edit_all_tasks"
  | "can_comment";

type PermissionRow = {
  can_manage_users: boolean;
  can_manage_permissions: boolean;
  can_create_task: boolean;
  can_edit_all_tasks: boolean;
  can_comment: boolean;
};

type RoleRow = {
  code: string;
  name: string;
  role_permissions: PermissionRow | null;
};

type StaffProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  roles: RoleRow | null;
};

type LoginRow = {
  id: string;
  email: string | null;
  phone: string | null;
  password: string | null;
  active: boolean;
};

type AuthUser = {
  id: string;
  full_name: string;
  email: string | null;
  username: string | null;
  role_code: string;
  role_name: string;
  active: boolean;
  permissions: Record<PermissionKey, boolean>;
};

type ModuleKey = "hr" | "assets" | "documents" | "performance";

type AuthContextType = {
  loading: boolean;
  user: AuthUser | null;
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (key: PermissionKey) => boolean;
  canAccessModule: (module: ModuleKey) => boolean;
  isReadOnly: () => boolean;
  canViewAllWorkHr: () => boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);
const SESSION_KEY = "thoidai_work_user_id";

function toAuthUser(row: StaffProfileRow): AuthUser {
  const perms = row.roles?.role_permissions;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    username: null,
    role_code: row.roles?.code ?? "",
    role_name: row.roles?.name ?? "",
    active: row.active,
    permissions: {
      can_manage_users: !!perms?.can_manage_users,
      can_manage_permissions: !!perms?.can_manage_permissions,
      can_create_task: !!perms?.can_create_task,
      can_edit_all_tasks: !!perms?.can_edit_all_tasks,
      can_comment: !!perms?.can_comment,
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const loadSession = async () => {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (!response.ok) {
      setUser(null);
      return;
    }
    const payload = await response.json() as { user?: AuthUser };
    setUser(payload.user ?? null);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        await loadSession();
        setLoading(false);
      })();
    }, 0);

    return () => clearTimeout(t);
  }, []);

  const login = async (identifier: string, password: string) => {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const normalizedPassword = password.trim();

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: normalizedIdentifier, password: normalizedPassword }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      return { ok: false, error: payload?.error || "Sai tài khoản hoặc mật khẩu." };
    }
    localStorage.removeItem(SESSION_KEY);
    await loadSession();
    return { ok: true };
  };

  const logout = () => {
    void fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const hasPermission = (key: PermissionKey) => {
    if (!user) return false;
    if (getRoleAccessPolicy(user.role_code).readOnly) return false;

    if (user.role_code === "admin") return true;

    const assignmentRoles = new Set([
      "pho_tong_bien_tap",
      "phu_trach_phong_tri_su",
      "phu_trach_phong_phong_vien",
      "phu_trach_phong_bien_tap",
    ]);

    // Quy ước nghiệp vụ: chỉ lãnh đạo + trưởng/phụ trách phòng mới được giao việc và xem/sửa toàn bộ việc.
    if (key === "can_create_task" || key === "can_edit_all_tasks") {
      return assignmentRoles.has(user.role_code);
    }

    return !!user.permissions[key];
  };

  const canAccessModule = (module: ModuleKey) => {
    if (!user) return false;

    const rolePolicy = getRoleAccessPolicy(user.role_code);
    if (rolePolicy.readOnly) {
      return rolePolicy.modules.includes(module === "performance" ? "hr" : (module === "documents" ? "documents" : module));
    }

    const leadership = new Set(["admin", "pho_tong_bien_tap"]);
    const operations = new Set(["phu_trach_phong_tri_su", "tri_su"]);
    const managers = new Set(["phu_trach_phong_bien_tap", "phu_trach_phong_phong_vien"]);

    if (leadership.has(user.role_code)) return true;

    if (module === "hr") return true;
    if (module === "assets") return true;
    if (module === "documents") return operations.has(user.role_code) || managers.has(user.role_code);
    if (module === "performance") return managers.has(user.role_code) || operations.has(user.role_code);

    return false;
  };

  const isReadOnly = () => !!user && getRoleAccessPolicy(user.role_code).readOnly;
  const canViewAllWorkHr = () => !!user && getRoleAccessPolicy(user.role_code).viewAllWorkHr;

  return <AuthContext.Provider value={{ loading, user, login, logout, hasPermission, canAccessModule, isReadOnly, canViewAllWorkHr }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
