"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  active: boolean;
  roles: RoleRow | null;
};

type LoginLookupRow = {
  id: string;
  email: string | null;
  active: boolean;
};

type AuthUser = {
  id: string;
  full_name: string;
  email: string | null;
  role_code: string;
  role_name: string;
  active: boolean;
  permissions: Record<PermissionKey, boolean>;
};

type AuthContextType = {
  loading: boolean;
  user: AuthUser | null;
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (key: PermissionKey) => boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

function toAuthUser(row: StaffProfileRow): AuthUser {
  const perms = row.roles?.role_permissions;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,

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

async function loadProfileByEmail(email: string) {
  const { data, error } = await supabase
    .from("staff_users")
    .select(
      "id,full_name,email,active,roles(code,name,role_permissions(can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment))",
    )
    .ilike("email", email)
    .single();

  if (error || !data) return null;
  return toAuthUser(data as unknown as StaffProfileRow);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (email) {
        const profile = await loadProfileByEmail(email);
        if (mounted) setUser(profile);
      }
      if (mounted) setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email;
      if (!email) {
        setUser(null);
        return;
      }
      void (async () => {
        const profile = await loadProfileByEmail(email);
        setUser(profile);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (identifier: string, password: string) => {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const normalizedPassword = password.trim();

    const emailGuess = normalizedIdentifier.includes("@")
      ? normalizedIdentifier
      : `${normalizedIdentifier}@diditravel.vn`;

    const { data: lookupData, error: lookupError } = await supabase
      .from("staff_users")
      .select("id,email,active")
      .ilike("email", emailGuess)
      .limit(1)
      .maybeSingle();

    const row = lookupData as LoginLookupRow | null;

    if (lookupError || !row) return { ok: false, error: "Không tìm thấy tài khoản nội bộ." };
    if (!row.active) return { ok: false, error: "Tài khoản đã bị khóa." };
    if (!row.email) return { ok: false, error: "Tài khoản này chưa có email để đăng nhập." };

    const email = row.email.trim().toLowerCase();

    // 1) Thử đăng nhập trực tiếp
    let signIn = await supabase.auth.signInWithPassword({ email, password: normalizedPassword });

    // 2) Nếu chưa có user trong auth.users thì đăng ký tự động rồi đăng nhập lại
    if (signIn.error && /invalid login credentials/i.test(signIn.error.message || "")) {
      const signUp = await supabase.auth.signUp({ email, password: normalizedPassword });
      if (signUp.error && !/already registered/i.test(signUp.error.message || "")) {
        return { ok: false, error: `Không thể tạo tài khoản Auth: ${signUp.error.message}` };
      }
      signIn = await supabase.auth.signInWithPassword({ email, password: normalizedPassword });
    }

    if (signIn.error) {
      if (/email not confirmed/i.test(signIn.error.message || "")) {
        return {
          ok: false,
          error: "Email chưa xác nhận. Vào Supabase Auth để tắt Confirm email (MVP) hoặc xác nhận email trước.",
        };
      }
      return { ok: false, error: `Đăng nhập thất bại: ${signIn.error.message}` };
    }

    const profile = await loadProfileByEmail(email);
    setUser(profile);

    if (!profile) {
      await supabase.auth.signOut();
      return { ok: false, error: "Email đăng nhập chưa được gán user trong staff_users." };
    }

    return { ok: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const hasPermission = (key: PermissionKey) => {
    if (!user) return false;

    const assignmentRoles = new Set([
      "tong_bien_tap",
      "pho_tong_bien_tap",
      "phu_trach_phong_tri_su",
      "phu_trach_phong_phong_vien",
      "phu_trach_phong_bien_tap",
    ]);

    if (key === "can_create_task" || key === "can_edit_all_tasks") {
      return assignmentRoles.has(user.role_code);
    }

    if (user.role_code === "tong_bien_tap") return true;
    return !!user.permissions[key];
  };

  return <AuthContext.Provider value={{ loading, user, login, logout, hasPermission }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
