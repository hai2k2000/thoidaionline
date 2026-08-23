"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getRoleAccessPolicy } from "@/components/appNavState";
import type { PermissionKey, PermissionSet } from "@/lib/permissions";
import type { AccountPreferences } from "@/lib/accountPreferences";

type AuthUser = {
  id: string;
  full_name: string;
  email: string | null;
  username: string | null;
  role_code: string;
  role_name: string;
  active: boolean;
  is_department_manager: boolean;
  permissions: PermissionSet;
  avatar_url: string | null;
  preferences: AccountPreferences;
};

type ModuleKey = "hr" | "assets" | "documents" | "performance";

type AuthContextType = {
  loading: boolean;
  user: AuthUser | null;
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (key: PermissionKey) => boolean;
  canAccessModule: (module: ModuleKey) => boolean;
  isReadOnly: () => boolean;
  canViewAllWorkHr: () => boolean;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);
const SESSION_KEY = "thoidai_work_user_id";
const PHASE2_PERMISSION_KEYS = new Set<PermissionKey>([
  "can_assign_task",
  "can_view_department_tasks",
  "can_evaluate_step1",
  "can_evaluate_step2",
  "can_manage_rubrics",
]);

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
    const timer = setTimeout(() => {
      void (async () => {
        await loadSession();
        setLoading(false);
      })();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("compact-mode", user?.preferences.compactMode === true);
    document.documentElement.classList.toggle("reduce-motion", user?.preferences.reduceMotion === true);
  }, [user?.preferences]);

  const login = async (identifier: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identifier: identifier.trim().toLowerCase(),
        password: password.trim(),
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      return {
        ok: false,
        error: payload?.error || "Sai t\u00e0i kho\u1ea3n ho\u1eb7c m\u1eadt kh\u1ea9u.",
      };
    }
    localStorage.removeItem(SESSION_KEY);
    await loadSession();
    return { ok: true };
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store", credentials: "same-origin" });
    } finally {
      localStorage.removeItem(SESSION_KEY);
      setUser(null);
    }
  };

  const hasPermission = (key: PermissionKey) => {
    if (!user) return false;
    if (PHASE2_PERMISSION_KEYS.has(key)) {
      return user.permissions[key] === true;
    }
    if (getRoleAccessPolicy(user.role_code).readOnly) return false;
    if (user.role_code === "admin") return true;

    const assignmentRoles = new Set([
      "pho_tong_bien_tap",
      "phu_trach_phong_tri_su",
      "phu_trach_phong_phong_vien",
      "phu_trach_phong_bien_tap",
    ]);
    if (key === "can_create_task" || key === "can_edit_all_tasks") {
      return assignmentRoles.has(user.role_code);
    }
    return user.permissions[key] === true;
  };

  const canAccessModule = (module: ModuleKey) => {
    if (!user) return false;
    const rolePolicy = getRoleAccessPolicy(user.role_code);
    if (rolePolicy.readOnly) {
      const policyModule = module === "performance"
        ? "hr"
        : module === "documents"
          ? "documents"
          : module;
      return rolePolicy.modules.includes(policyModule);
    }

    const leadership = new Set(["admin", "pho_tong_bien_tap"]);
    const operations = new Set(["phu_trach_phong_tri_su", "tri_su"]);
    const managers = new Set([
      "phu_trach_phong_bien_tap",
      "phu_trach_phong_phong_vien",
    ]);
    if (leadership.has(user.role_code)) return true;
    if (module === "hr" || module === "assets") return true;
    if (module === "documents") {
      return operations.has(user.role_code) || managers.has(user.role_code);
    }
    if (module === "performance") {
      return managers.has(user.role_code) || operations.has(user.role_code);
    }
    return false;
  };

  const isReadOnly = () =>
    !!user && getRoleAccessPolicy(user.role_code).readOnly;
  const canViewAllWorkHr = () =>
    !!user && getRoleAccessPolicy(user.role_code).viewAllWorkHr;

  return (
    <AuthContext.Provider
      value={{
        loading,
        user,
        login,
        logout,
        hasPermission,
        canAccessModule,
        isReadOnly,
        canViewAllWorkHr,
        refreshSession: loadSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
