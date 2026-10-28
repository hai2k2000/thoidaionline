"use client";
import { useMemo, useState } from "react";
import type { UserRow } from "./types";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
export default function UserListPanel({ users, selectedUserId, onSelect }: {
    users: UserRow[];
    selectedUserId: string;
    onSelect: (id: string) => void;
}) {
    const [query, setQuery] = useState("");
    const [department, setDepartment] = useState("");
    const [role, setRole] = useState("");
    const [status, setStatus] = useState("active");
    const [onlyOverrides, setOnlyOverrides] = useState(false);
    const departments = useMemo(() => [...new Set(users.map((user) => user.department_name).filter(Boolean))] as string[], [users]);
    const roles = useMemo(() => [...new Set(users.map((user) => user.role_code).filter(Boolean))] as string[], [users]);
    const filtered = users.filter((user) => {
        const matchesQuery = !query || normalize(`${user.full_name} ${user.username ?? ""}`).includes(normalize(query));
        const matchesStatus = status === "all" || (status === "active" ? user.active : !user.active);
        return matchesQuery && (!department || user.department_name === department) && (!role || user.role_code === role) && matchesStatus && (!onlyOverrides || (user.override_count ?? 0) > 0);
    });
    return (<aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <input aria-label="Tìm tên hoặc tài khoản" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-xl border px-3 py-2"/>
      <div className="mt-3 grid gap-2">
        <select value={department} onChange={(event) => setDepartment(event.target.value)}>
          <option value="">Phòng ban</option>
          {departments.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select value={role} onChange={(event) => setRole(event.target.value)}><option value="">Vai trò</option>{roles.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Không hoạt động</option>
          <option value="all">Tất cả</option>
        </select>
        <label><input type="checkbox" checked={onlyOverrides} onChange={(event) => setOnlyOverrides(event.target.checked)}/> Chỉ người có quyền riêng</label>
      </div>
      <div className="mt-4 space-y-1">
        {filtered.map((user) => (<button key={user.id} onClick={() => onSelect(user.id)} className={`w-full rounded-xl px-3 py-3 text-left ${selectedUserId === user.id ? "bg-orange-50" : ""}`}>
            <b>{user.full_name}</b>
            <span className="block text-xs text-slate-500">{user.department_name ?? "—"}</span>
          </button>))}
      </div>
    </aside>);
}

