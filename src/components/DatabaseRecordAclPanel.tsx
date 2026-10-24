"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PrincipalType = "user" | "role";
type Effect = "allow" | "deny";
type AclRow = { id: string; principal_type: string; principal_id: string; capability: string; effect: Effect; expires_at?: string | null };
type UserOption = { id: string; full_name: string; username?: string | null; active: boolean };
type RoleOption = { id: string; code: string; name: string; active: boolean };
type Props = { recordId: string; blockReason?: string | null; onUpdated: () => Promise<void> };

const reasonLabels: Record<string, string> = {
  record_not_pending: "Hồ sơ không còn ở trạng thái Chờ duyệt.",
  record_type_restricted: "Tài khoản hiện tại không được phép xử lý loại hồ sơ này.",
  missing_record_approve_permission: "Tài khoản chưa có quyền RBAC record.approve hiệu lực.",
  approval_acl_denied: "ACL của hồ sơ đang từ chối quyền approve cho tài khoản này.",
  missing_approval_acl_allow: "ACL hồ sơ chưa có dòng approve=allow áp dụng cho tài khoản này.",
  missing_self_approve_permission: "Người tạo hồ sơ chưa có record.self_approve với scope self hoặc all.",
};

export default function DatabaseRecordAclPanel({ recordId, blockReason, onUpdated }: Props) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [acl, setAcl] = useState<AclRow[]>([]);
  const [principalType, setPrincipalType] = useState<PrincipalType>("user");
  const [principalId, setPrincipalId] = useState("");
  const [effect, setEffect] = useState<Effect>("allow");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const options = principalType === "user" ? users : roles;
  const approveAcl = useMemo(() => acl.filter((row) => row.capability === "approve"), [acl]);
  const labelFor = (row: AclRow) => {
    const option = (row.principal_type === "user" ? users : roles).find((item) => item.id === row.principal_id);
    if (!option) return `${row.principal_type}:${row.principal_id}`;
    return row.principal_type === "user" ? `${(option as UserOption).full_name}${(option as UserOption).username ? ` (${(option as UserOption).username})` : ""}` : `${(option as RoleOption).name} (${(option as RoleOption).code})`;
  };

  const load = useCallback(async () => {
    setBusy(true);
    const response = await fetch(`/api/database/records/${recordId}/acl`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { acl?: AclRow[]; users?: UserOption[]; roles?: RoleOption[]; error?: string } | null;
    if (!response.ok) {
      setMessage(response.status === 403 ? "Bạn không có quyền quản lý ACL hồ sơ này." : "Không thể tải ACL hồ sơ.");
      setBusy(false);
      return;
    }
    const nextUsers = payload?.users ?? [];
    const nextRoles = payload?.roles ?? [];
    setUsers(nextUsers);
    setRoles(nextRoles);
    setAcl(payload?.acl ?? []);
    const nextOptions = principalType === "user" ? nextUsers : nextRoles;
    setPrincipalId(nextOptions[0]?.id ?? "");
    setMessage("");
    setBusy(false);
  }, [principalType, recordId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save() {
    if (!principalId) return;
    setSaving(true);
    const response = await fetch(`/api/database/records/${recordId}/acl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ principalType, principalId, capability: "approve", effect }),
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    setSaving(false);
    if (!response.ok) {
      setMessage(payload?.error === "forbidden" ? "Bạn không có quyền cập nhật ACL hồ sơ này." : "Không thể cập nhật ACL hồ sơ.");
      return;
    }
    setMessage("Đã cập nhật quyền approve và ghi audit.");
    await load();
    await onUpdated();
  }

  return <section className="mt-6 rounded-xl border border-orange-200 bg-orange-50/40 p-4" aria-label="Quản lý ACL hồ sơ">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-sm font-bold uppercase tracking-wide text-orange-900">Quản lý quyền duyệt hồ sơ</h2><p className="mt-1 text-xs text-orange-900/70">Chỉ tài khoản có quyền quản lý ACL mới nhìn thấy và thay đổi được phần này.</p></div>
      {blockReason ? <p className="max-w-xl rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>Chưa thể phê duyệt:</b> {reasonLabels[blockReason] ?? "Điều kiện phê duyệt chưa đáp ứng."}</p> : null}
    </div>
    {busy ? <p className="mt-3 text-sm text-slate-600">Đang tải ACL...</p> : <>
      <div className="mt-4 grid gap-3 rounded-lg border border-orange-100 bg-white p-3 md:grid-cols-[150px_minmax(0,1fr)_130px_auto] md:items-end">
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Đối tượng<select value={principalType} onChange={(event) => { const nextType = event.target.value as PrincipalType; setPrincipalType(nextType); const nextOptions = nextType === "user" ? users : roles; setPrincipalId(nextOptions[0]?.id ?? ""); }} className="min-h-10 rounded-lg border border-slate-300 px-2 text-sm font-normal"><option value="user">Người dùng</option><option value="role">Vai trò</option></select></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Chọn người/vai trò<select value={principalId} onChange={(event) => setPrincipalId(event.target.value)} className="min-h-10 rounded-lg border border-slate-300 px-2 text-sm font-normal"><option value="">Chọn...</option>{options.map((item) => <option key={item.id} value={item.id}>{principalType === "user" ? `${(item as UserOption).full_name}${(item as UserOption).username ? ` · ${(item as UserOption).username}` : ""}` : `${(item as RoleOption).name} · ${(item as RoleOption).code}`}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">Hiệu lực<select value={effect} onChange={(event) => setEffect(event.target.value as Effect)} className="min-h-10 rounded-lg border border-slate-300 px-2 text-sm font-normal"><option value="allow">Cho phép approve</option><option value="deny">Từ chối approve</option></select></label>
        <button type="button" disabled={saving || !principalId} onClick={() => void save()} className="min-h-10 rounded-lg bg-orange-600 px-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu ACL"}</button>
      </div>
      {approveAcl.length ? <div className="mt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">ACL approve hiện tại</h3><ul className="mt-2 space-y-2 text-sm">{approveAcl.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"><span>{labelFor(row)}</span><span className={row.effect === "allow" ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800" : "rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-800"}>{row.effect === "allow" ? "Cho phép" : "Từ chối"}</span></li>)}</ul></div> : <p className="mt-4 text-sm text-slate-600">Chưa có ACL approve. Người có record.approve vẫn chưa thể duyệt cho đến khi có dòng Cho phép.</p>}
    </>}
    {message ? <p role="status" className="mt-3 text-sm text-slate-700">{message}</p> : null}
  </section>;
}
