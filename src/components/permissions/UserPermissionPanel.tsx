"use client";
import UserListPanel from "./UserListPanel";
import UserPermissionDetail from "./UserPermissionDetail";
import type { UserPermissionPanelProps } from "./types";
export { default as UserListPanel } from "./UserListPanel";
export { default as UserPermissionDetail } from "./UserPermissionDetail";
export default function UserPermissionPanel({ users, selectedUserId, onSelect, currentUserId, onChanged, onToast, genericModules, scopeOptions, }: UserPermissionPanelProps) {
    const selected = selectedUserId ? users.find((user) => user.id === selectedUserId) : undefined;
    return (<section className="grid gap-4 md:grid-cols-[280px_1fr]">
      <div className={selected ? "hidden md:block" : "block"}>
        <UserListPanel users={users} selectedUserId={selected?.id ?? ""} onSelect={onSelect}/>
      </div>
      <div className={!selected ? "hidden md:block" : "block"}>
        {selected ? (<UserPermissionDetail user={selected} currentUserId={currentUserId} onChanged={onChanged} onToast={onToast} genericModules={genericModules} scopeOptions={scopeOptions}
  onBack={() => onSelect("")}/>) : (<p className="rounded-2xl bg-white p-6 text-sm text-slate-500">Chưa chọn người dùng.</p>)}
      </div>
    </section>);
}

