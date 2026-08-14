"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppNav from "@/components/AppNav";
import { sortStaffRows } from "@/lib/staffOrdering";

type Role = { id: string; code?: string; name: string; level?: number };
type JobTitle = { id: string; code?: string; name: string; display_order?: number; active?: boolean };
type Department = { id: string; code?: string; name: string; active?: boolean };
type User = {
  id: string;
  full_name: string;
  username?: string | null;
  email: string | null;
  role_id: string;
  job_title_id?: string | null;
  department_id: string;
  active: boolean;
  list_order?: number | null;
  roles?: { code?: string; name?: string; level?: number } | null;
  job_titles?: { code?: string; name?: string; display_order?: number; active?: boolean } | null;
  departments?: { code?: string; name?: string } | null;
};
type UsersPayload = { error?: string; roles?: Role[]; job_titles?: JobTitle[]; departments?: Department[]; users?: User[] };

const canViewUsers = (code: string) => ["admin", "tong_bien_tap", "tbt_read_only"].includes(code);

export default function UsersPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [deps, setDeps] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("Đang tải...");
  const [filterDepId, setFilterDepId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "disabled">("all");
  const [selected, setSelected] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editDep, setEditDep] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [newUser, setNewUser] = useState({ full_name: "", username: "", role_id: "", job_title_id: "", department_id: "" });
  const isAdmin = user?.role_code === "admin";

  const fetchAll = async () => {
    const response = await fetch("/api/users", { cache: "no-store" });
    const payload = await response.json().catch(() => null) as UsersPayload | null;
    if (!response.ok) throw new Error(payload?.error || "Không thể tải danh sách.");
    return payload ?? {};
  };

  const applyPayload = (payload: UsersPayload) => {
    setRoles(payload?.roles ?? []);
    setJobTitles(payload?.job_titles ?? []);
    setDeps(payload?.departments ?? []);
    setUsers(payload?.users ?? []);
  };

  const loadAll = async (successMessage = "✅ Đã tải danh sách nhân viên.") => {
    try {
      const payload = await fetchAll();
      applyPayload(payload);
      setMessage(successMessage);
    } catch (error) {
      setMessage(`❌ ${(error as Error).message}`);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canViewUsers(user.role_code)) return void router.push("/");
    const t = setTimeout(() => { void loadAll(); }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, router]);

  const filteredUsers = useMemo(() => {
    const filtered = users.filter((u) => {
      const okDep = !filterDepId || u.department_id === filterDepId;
      const okStatus = filterStatus === "all" || (filterStatus === "active" ? u.active : !u.active);
      return okDep && okStatus;
    });
    return sortStaffRows(filtered);
  }, [users, filterDepId, filterStatus]);

  const setEditState = (u: User) => {
    setSelected(u);
    setEditName(u.full_name);
    setEditRole(u.role_id);
    setEditJobTitle(u.job_title_id ?? "");
    setEditDep(u.department_id);
    setEditActive(u.active);
  };

  const openUser = async (u: User) => {
    setMessage("Đang tải thông tin mới nhất...");
    try {
      const payload = await fetchAll();
      applyPayload(payload);
      const freshUser = (payload.users ?? []).find((row) => row.id === u.id);
      if (!freshUser) throw new Error("Không tìm thấy user.");
      setEditState(freshUser);
      setMessage("✅ Đã tải thông tin mới nhất.");
    } catch (error) {
      setSelected(null);
      setMessage(`❌ ${(error as Error).message}`);
    }
  };

  const saveUser = async () => {
    if (!selected || !isAdmin) return;
    if (!editJobTitle) return setMessage("❌ Vui lòng chọn chức vụ.");
    const changes: Record<string, string | boolean> = { user_id: selected.id };
    if (editName.trim() !== selected.full_name) changes.full_name = editName;
    if (editRole !== selected.role_id) changes.role_id = editRole;
    if (editJobTitle !== (selected.job_title_id ?? "")) changes.job_title_id = editJobTitle;
    if (editDep !== selected.department_id) changes.department_id = editDep;
    if (editActive !== selected.active) changes.active = editActive;
    if (Object.keys(changes).length === 1) return setMessage("Không có thay đổi để lưu.");
    const response = await fetch("/api/users", { method: "PATCH", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(changes) });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) return setMessage(`❌ ${payload?.error || "Không thể cập nhật user."}`);
    setSelected(null);
    await loadAll("✅ Đã cập nhật thông tin user.");
    router.refresh();
  };

  const createUser = async () => {
    if (!isAdmin) return;
    const response = await fetch("/api/users", { method: "POST", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(newUser) });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) return setMessage(`❌ ${payload?.error || "Không thể tạo user."}`);
    setNewUser({ full_name: "", username: "", role_id: "", job_title_id: "", department_id: "" });
    await loadAll("✅ Đã tạo user.");
    router.refresh();
  };

  return <main className="min-h-screen bg-slate-50 p-6 text-slate-900"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4"><div className="mb-4 lg:mb-0"><AppNav currentPath="/users" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} /></div><div>
    <h1 className="mb-4 text-2xl font-bold">Quản lý nhân viên</h1>
    {isAdmin ? <section className="rounded-xl border bg-white p-4"><h2 className="mb-2 font-semibold">Tạo user</h2><div className="grid gap-2 md:grid-cols-5"><input className="rounded border px-3 py-2" placeholder="Họ tên" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} /><select className="rounded border px-3 py-2" value={newUser.job_title_id} onChange={(e) => setNewUser({ ...newUser, job_title_id: e.target.value })}><option value="">Chức vụ</option>{jobTitles.filter((j) => j.active !== false).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}</select><select className="rounded border px-3 py-2" value={newUser.role_id} onChange={(e) => setNewUser({ ...newUser, role_id: e.target.value })}><option value="">Role quyền</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><select className="rounded border px-3 py-2" value={newUser.department_id} onChange={(e) => setNewUser({ ...newUser, department_id: e.target.value })}><option value="">Phòng ban</option>{deps.filter((d) => d.active !== false).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div><button onClick={createUser} className="mt-3 rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Tạo user</button></section> : null}
    <section className="mt-4 rounded-xl border bg-white p-4"><div className="mb-3 grid gap-2 md:grid-cols-3"><select className="rounded border px-3 py-2" value={filterDepId} onChange={(e) => setFilterDepId(e.target.value)}><option value="">Lọc theo phòng ban (tất cả)</option>{deps.filter((d) => d.active !== false).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><select className="rounded border px-3 py-2" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "disabled")}><option value="all">Trạng thái: Tất cả</option><option value="active">Active</option><option value="disabled">Disable</option></select><button onClick={() => { setFilterDepId(""); setFilterStatus("all"); }} className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold">Xóa bộ lọc</button></div><p className="mb-2 text-sm text-slate-600">{message}</p><div className="overflow-auto rounded-lg border"><table className="min-w-full text-left text-sm"><thead><tr><th className="px-2 py-2">Họ tên</th><th className="px-2 py-2">Username</th><th className="px-2 py-2">Chức vụ</th><th className="px-2 py-2">Role quyền</th><th className="px-2 py-2">Phòng ban</th><th className="px-2 py-2">Trạng thái</th></tr></thead><tbody>{filteredUsers.map((u) => <tr key={u.id} className="border-t"><td className="px-2 py-2"><button onClick={() => void openUser(u)} className="font-semibold text-orange-800 underline-offset-2 hover:underline">{u.full_name}</button></td><td className="px-2 py-2">{u.username ?? "-"}</td><td className="px-2 py-2">{u.job_titles?.name ?? "-"}</td><td className="px-2 py-2">{u.roles?.name ?? "-"}</td><td className="px-2 py-2">{deps.find((d) => d.id === u.department_id)?.name ?? "-"}</td><td className="px-2 py-2">{u.active ? "active" : "disable"}</td></tr>)}{filteredUsers.length === 0 ? <tr><td colSpan={6} className="px-2 py-6 text-center text-slate-500">Không có user phù hợp bộ lọc.</td></tr> : null}</tbody></table></div></section>
    {selected ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Thông tin nhân sự</h2><button onClick={() => setSelected(null)} className="text-xl" aria-label="Đóng">×</button></div><div className="mt-4 space-y-3"><label className="block text-sm">Họ tên<input disabled={!isAdmin} className="mt-1 w-full rounded border px-3 py-2 disabled:bg-slate-100" value={editName} onChange={(e) => setEditName(e.target.value)} /></label><p className="text-sm"><b>Username:</b> {selected.username ?? "-"}</p><p className="text-sm"><b>Email:</b> {selected.email ?? "-"} <span className="text-xs text-slate-500">(không chỉnh sửa tại đây)</span></p><label className="block text-sm">Chức vụ<select disabled={!isAdmin} className="mt-1 w-full rounded border px-3 py-2 disabled:bg-slate-100" value={editJobTitle} onChange={(e) => setEditJobTitle(e.target.value)}><option value="" disabled>Chọn chức vụ</option>{jobTitles.filter((j) => j.active !== false || j.id === editJobTitle).map((j) => <option key={j.id} value={j.id}>{j.name}{j.active === false ? " (đã ngừng sử dụng)" : ""}</option>)}</select></label><label className="block text-sm">Role quyền<select disabled={!isAdmin} className="mt-1 w-full rounded border px-3 py-2 disabled:bg-slate-100" value={editRole} onChange={(e) => setEditRole(e.target.value)}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label className="block text-sm">Phòng ban<select disabled={!isAdmin} className="mt-1 w-full rounded border px-3 py-2 disabled:bg-slate-100" value={editDep} onChange={(e) => setEditDep(e.target.value)}>{deps.filter((d) => d.active !== false).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!isAdmin} checked={editActive} onChange={(e) => setEditActive(e.target.checked)} /> Đang hoạt động</label></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setSelected(null)} className="rounded bg-slate-200 px-3 py-2 text-sm">Đóng</button>{isAdmin ? <button onClick={saveUser} className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Lưu thay đổi</button> : null}</div>{!isAdmin ? <p className="mt-3 text-xs text-slate-500">TBT chỉ được xem thông tin; chỉ Admin mới được lưu.</p> : null}</div></div> : null}
  </div></div></main>;
}
