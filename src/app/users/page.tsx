"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import AppNav from "@/components/AppNav";

type Role = { id: string; code?: string; name: string; level?: number };
type Department = { id: string; code?: string; name: string; active?: boolean };
type User = {
  id: string;
  full_name: string;
  username?: string | null;
  email: string | null;
  role_id: string;
  department_id: string;
  active: boolean;
  roles?: { code?: string; name?: string; level?: number } | null;
};

export default function UsersPage() {
  const router = useRouter();
  const { loading: authLoading, user, hasPermission, logout } = useAuth();

  const [roles, setRoles] = useState<Role[]>([]);
  const [deps, setDeps] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("Đang tải...");

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [depId, setDepId] = useState("");

  const [filterDepId, setFilterDepId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "disabled">("all");

  const depNameMap = useMemo(() => {
    const m = new Map<string, string>();
    deps.forEach((d) => m.set(d.id, d.name));
    return m;
  }, [deps]);

  const filteredUsers = useMemo(() => {
    const roleRank: Record<string, number> = {
      tong_bien_tap: 1, // đứng đầu ban biên tập
      pho_tong_bien_tap: 2,
      phu_trach_phong_tri_su: 3,
      phu_trach_phong_bien_tap: 3,
      phu_trach_phong_phong_vien: 3,
      tri_su: 4,
      bien_tap_vien: 4,
      phong_vien: 5,
    };

    const departmentRank: Record<string, number> = {
      leadership: 1, // Ban biên tập
      editorial: 2, // Phòng biên tập
      admin: 3, // Phòng trị sự
      reporter: 4, // Phòng phóng viên
      general: 5,
    };

    return users
      .filter((u) => {
        const okDep = !filterDepId || u.department_id === filterDepId;
        const okStatus = filterStatus === "all" || (filterStatus === "active" ? u.active : !u.active);
        return okDep && okStatus;
      })
      .sort((a, b) => {
        const roleA = roleRank[a.roles?.code ?? ""] ?? 99;
        const roleB = roleRank[b.roles?.code ?? ""] ?? 99;
        if (roleA !== roleB) return roleA - roleB;

        const codeA = deps.find((d) => d.id === a.department_id)?.code ?? "";
        const codeB = deps.find((d) => d.id === b.department_id)?.code ?? "";
        const depA = departmentRank[codeA] ?? 99;
        const depB = departmentRank[codeB] ?? 99;
        if (depA !== depB) return depA - depB;

        return a.full_name.localeCompare(b.full_name, "vi");
      });
  }, [users, filterDepId, filterStatus, deps]);

  const loadAll = async () => {
    const [r, d, u] = await Promise.all([
      supabase.from("roles").select("id,code,name,level").order("level", { ascending: false }),
      supabase.from("departments").select("id,code,name,active").order("name"),
      supabase.from("staff_users").select("id,full_name,username,email,role_id,department_id,active,roles(code,name,level)").order("created_at", { ascending: false }),
    ]);
    if (r.error || d.error || u.error) return setMessage(`❌ ${r.error?.message || d.error?.message || u.error?.message}`), undefined;
    setRoles((r.data ?? []) as Role[]);
    setDeps((d.data ?? []) as Department[]);
    setUsers((u.data ?? []) as User[]);
    setMessage("✅ Đã tải danh sách nhân viên.");
  };

  const createUser = async () => {
    if (!fullName.trim() || !username.trim() || !roleId || !depId) return setMessage("❌ Thiếu dữ liệu user."), undefined;
    const { error } = await supabase.from("staff_users").insert({
      full_name: fullName.trim(),
      username: username.trim().toLowerCase(),
      email: email || null,
      role_id: roleId,
      department_id: depId,
      active: true,
      password: "123456",
    });
    if (error) return setMessage(`❌ ${error.message}`), undefined;
    setFullName("");
    setUsername("");
    setEmail("");
    await loadAll();
  };

  const updateUser = async (id: string, patch: Partial<User>) => {
    const { error } = await supabase.from("staff_users").update(patch).eq("id", id);
    if (error) return setMessage(`❌ ${error.message}`), undefined;
    await loadAll();
  };

  const updateUserRoleWithDepartment = async (u: User, newRoleId: string) => {
    const role = roles.find((r) => r.id === newRoleId);
    const roleCode = role?.code ?? "";

    let autoDepartmentId = u.department_id;
    if (roleCode === "phu_trach_phong_phong_vien" || roleCode === "phong_vien") {
      autoDepartmentId = deps.find((d) => d.code === "reporter")?.id ?? autoDepartmentId;
    } else if (roleCode === "phu_trach_phong_tri_su" || roleCode === "tri_su") {
      autoDepartmentId = deps.find((d) => d.code === "admin")?.id ?? autoDepartmentId;
    } else if (roleCode === "phu_trach_phong_bien_tap" || roleCode === "bien_tap_vien") {
      autoDepartmentId = deps.find((d) => d.code === "editorial")?.id ?? autoDepartmentId;
    } else if (roleCode === "tong_bien_tap" || roleCode === "pho_tong_bien_tap") {
      autoDepartmentId = deps.find((d) => d.code === "leadership")?.id ?? autoDepartmentId;
    }

    const { error } = await supabase.from("staff_users").update({ role_id: newRoleId, department_id: autoDepartmentId }).eq("id", u.id);
    if (error) return setMessage(`❌ ${error.message}`), undefined;

    setMessage("✅ Đã cập nhật chức vụ và tự động xếp lại phòng ban phù hợp.");
    await loadAll();
  };

  const resetPassword = async (id: string) => {
    const { error } = await supabase.from("staff_users").update({ password: "123456" }).eq("id", id);
    if (error) return setMessage(`❌ Reset mật khẩu lỗi: ${error.message}`), undefined;
    setMessage("✅ Đã reset mật khẩu về mặc định 123456.");
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!hasPermission("can_manage_users")) return void router.push("/");
    const t = setTimeout(() => {
      void loadAll();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, hasPermission, router]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Quản lý nhân viên</h1>
          <div className="mt-2">
            <AppNav currentPath="/users" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>

        <section className="rounded-xl border bg-white p-4">
          <div className="grid gap-2 md:grid-cols-5">
            <input className="rounded border px-3 py-2" placeholder="Họ tên" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Username (vd: quangthien)" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="rounded border px-3 py-2" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">Role</option>
              {roles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <select className="rounded border px-3 py-2" value={depId} onChange={(e) => setDepId(e.target.value)}>
              <option value="">Phòng ban</option>
              {deps.filter((x) => x.active !== false).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={createUser} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Tạo user</button>
            <button onClick={loadAll} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Tải danh sách</button>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <div className="mb-3 grid gap-2 md:grid-cols-3">
            <select className="rounded border px-3 py-2" value={filterDepId} onChange={(e) => setFilterDepId(e.target.value)}>
              <option value="">Lọc theo phòng ban (tất cả)</option>
              {deps.filter((x) => x.active !== false).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <select className="rounded border px-3 py-2" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "disabled")}>
              <option value="all">Trạng thái: Tất cả</option>
              <option value="active">Trạng thái: Active</option>
              <option value="disabled">Trạng thái: Disable</option>
            </select>
            <button onClick={() => { setFilterDepId(""); setFilterStatus("all"); }} className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-blue-50 hover:text-blue-800">
              Xóa bộ lọc
            </button>
          </div>

          <p className="mb-2 text-xs text-slate-500">Danh sách tự sắp xếp theo: Ban biên tập → Phòng biên tập → Phòng trị sự → Phòng phóng viên; trong mỗi phòng ưu tiên chức vụ cao trước.</p>
          <div className="overflow-auto rounded-lg border border-rose-100">
            <table className="table-soft-red min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-2">Tên</th>
                  <th className="px-2 py-2">Username</th>
                  <th className="px-2 py-2">Chức vụ</th>
                  <th className="px-2 py-2">Phòng ban</th>
                  <th className="px-2 py-2">Trạng thái</th>
                  <th className="px-2 py-2">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="align-middle">
                    <td className="px-2 py-2">
                      <Link href={`/users/${u.id}`} className="inline-flex items-center rounded border border-blue-200 bg-gradient-to-r from-cyan-50 to-blue-200 px-2 py-1 font-semibold text-blue-800 hover:from-cyan-100 hover:to-blue-300">
                        {u.full_name}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{u.username ?? "-"}</td>
                    <td className="px-2 py-2">
                      <select
                        className="rounded border px-2 py-1"
                        value={u.role_id}
                        onChange={(e) => updateUserRoleWithDepartment(u, e.target.value)}
                      >
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className="rounded border px-2 py-1"
                        value={u.department_id}
                        onChange={(e) => updateUser(u.id, { department_id: e.target.value })}
                      >
                        {deps.filter((x) => x.active !== false).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <div className="mt-1 text-xs text-slate-500">Hiện tại: {depNameMap.get(u.department_id) ?? "-"}</div>
                    </td>
                    <td className="px-2 py-2">{u.active ? "active" : "disable"}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => updateUser(u.id, { active: !u.active })} className="rounded bg-slate-200 px-2 py-1 text-xs">{u.active ? "Disable" : "Enable"}</button>
                        <button onClick={() => resetPassword(u.id)} className="rounded bg-amber-500 px-2 py-1 text-xs text-white">Reset mật khẩu</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td className="px-2 py-6 text-center text-slate-500" colSpan={6}>Không có user phù hợp bộ lọc.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
