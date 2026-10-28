"use client";
import { useState } from "react";
import ApprovalPermissionsCard from "./ApprovalPermissionsCard";
import OtherPermissionsSection from "./OtherPermissionsSection";
import PermissionHistoryDrawer from "./PermissionHistoryDrawer";
import GrantDialog from "./GrantDialog";
import RevokeDialog from "./RevokeDialog";
import usePermissionUserDetail from "./usePermissionUserDetail";
import type { PermissionItem, PermissionModule, Scope, UserRow } from "./types";
type Props = {
    user: UserRow;
    currentUserId?: string;
    onChanged: () => Promise<void>;
    onToast: (message: string) => void;
    genericModules?: PermissionModule[];
    scopeOptions?: Record<string, Scope[]>;
    onBack: () => void;
};
export default function UserPermissionDetail({ user, currentUserId, onChanged, onToast, genericModules = [], scopeOptions = {}, onBack }: Props) {
    const { items, loading, error, setError, load } = usePermissionUserDetail(user.id);
    const [history, setHistory] = useState(false);
    const [grantItem, setGrantItem] = useState<PermissionItem | null>(null);
    const [revokeItem, setRevokeItem] = useState<PermissionItem | null>(null);
    const self = currentUserId === user.id;
    const write = async (body: Record<string, unknown>) => {
        const response = await fetch("/api/permissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (!response.ok)
            throw new Error("Không thể cập nhật quyền.");
        await load();
        await onChanged();
        onToast("Đã cập nhật quyền.");
    };
    const setOther = (permissionCode: string, value: string, scope?: Scope) => {
        const body = value === "inherit"
            ? { action: "clear_user_override", userId: user.id, permissionCode }
            : { action: "set_user_override", userId: user.id, permissionCode, effect: value, scope: scope ?? scopeOptions[permissionCode]?.[0] ?? "all" };
        void write(body).catch((reason) => setError(reason.message));
    };
    const onApprovalSet = (item: PermissionItem, value: string) => value === "allow" ? setGrantItem(item) : setRevokeItem(item);
    const submitGrant = async (scope: Scope) => {
        if (!grantItem) return;
        await write({ action: "set_user_override", userId: user.id, permissionCode: grantItem.permissionCode, effect: "allow", scope });
        setGrantItem(null);
    };
    const submitRevoke = async (mode: "clear" | "deny") => {
        if (!revokeItem) return;
        const body = mode === "clear"
            ? { action: "clear_user_override", userId: user.id, permissionCode: revokeItem.permissionCode }
            : { action: "set_user_override", userId: user.id, permissionCode: revokeItem.permissionCode, effect: "deny", scope: revokeItem.userScope ?? "all" };
        await write(body);
        setRevokeItem(null);
    };
    return (<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <button type="button" onClick={onBack} className="mb-3 text-sm font-semibold text-orange-700 md:hidden">← Danh sách</button>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold">{user.full_name}</h2>
          <p className="text-sm text-slate-600">{user.department_name ?? "—"} · {user.job_title ?? "—"} · Vai trò: {user.role_name ?? user.role_code ?? "—"}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
            <span className={user.active ? "rounded-full bg-emerald-100 px-2 py-1 text-emerald-800" : "rounded-full bg-slate-200 px-2 py-1 text-slate-700"}>
              {user.active ? "Đang hoạt động" : "Không hoạt động"}
            </span>
            {(user.override_count ?? 0) > 0 ? <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-800">{user.override_count} quyền riêng</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setHistory(true)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Lịch sử thay đổi</button>
          <button type="button" disabled={self || !user.active || (user.override_count ?? 0) === 0} onClick={() => {
            const confirmed = window.confirm(`Xóa toàn bộ ${user.override_count ?? 0} quyền cấp/chặn riêng của ${user.full_name}? Hiệu lực ngay.`);
            if (confirmed)
                void write({ action: "restore_user_inheritance", userId: user.id }).catch((reason) => setError(reason.message));
        }} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">
            Khôi phục tất cả mặc định
          </button>
        </div>
      </header>
      {loading ? <p>Đang tải quyền…</p> : <>
        <ApprovalPermissionsCard items={items} active={user.active} self={self} userName={user.full_name} onSet={onApprovalSet} onGrant={setGrantItem} onRevoke={setRevokeItem}/>
        <OtherPermissionsSection user={user} modules={genericModules} active={user.active} self={self} scopeOptions={scopeOptions} onSet={setOther}/>
      </>}
      {error ? <p role="alert">{error}</p> : null}
      {history ? <PermissionHistoryDrawer userId={user.id} onClose={() => setHistory(false)}/> : null}
      {grantItem ? <GrantDialog item={grantItem} userName={user.full_name} departmentName={user.department_name}
        active={user.active} onClose={() => setGrantItem(null)} onSubmit={submitGrant}/> : null}
      {revokeItem ? <RevokeDialog item={revokeItem} onClose={() => setRevokeItem(null)} onSubmit={submitRevoke}/> : null}
    </div>);
}

