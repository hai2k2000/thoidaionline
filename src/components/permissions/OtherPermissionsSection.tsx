"use client";
import { APPROVAL_PERMISSION_CODES } from "@/lib/approvalPermissionView.mjs";
import type { PermissionModule, Scope, UserRow } from "./types";
const labels: Record<Scope, string> = { self: "Cá nhân", assigned: "Được giao", department: "Phòng ban", all: "Toàn cơ quan" };
export default function OtherPermissionsSection({ user, modules, active, self, scopeOptions, onSet }: {
    user: UserRow;
    modules: PermissionModule[];
    active: boolean;
    self: boolean;
    scopeOptions?: Record<string, Scope[]>;
    onSet: (code: string, value: string, scope?: Scope) => void;
}) {
    return <details className="mt-5 rounded-xl border border-slate-200"><summary className="cursor-pointer px-4 py-3 text-sm font-extrabold uppercase tracking-wide">Các quyền khác</summary>
  <div className="space-y-4 p-4">{modules.map((module) => <section key={module.key}>
  <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">{module.key}</h4>{module.permissions.filter((permission) =>
  !APPROVAL_PERMISSION_CODES.includes(permission.code)).map((permission) => { const override = user.overrides?.[permission.code]; const effective = user.effective?.[permission.code];
  const state = override?.effect ?? "inherit"; const options = scopeOptions?.[permission.code] ?? ["self", "assigned", "department", "all"];
  return <div key={permission.code} className="grid gap-3 border-t py-3 md:grid-cols-[1fr_auto]"><div><b>{permission.name}</b>
  <p className="font-mono text-xs text-slate-500">{permission.code}</p>
  <p className="text-xs text-slate-500">Hiệu lực: {effective?.scopes.map((scope) => labels[scope]).join(", ") || "Không có"}</p></div><div className="flex flex-wrap items-center gap-2">
  <select aria-label={`Thiết lập ${permission.name}`} disabled={self || !active} value={state} onChange={(event) => onSet(permission.code, event.target.value,
  override?.scope)} className="rounded-lg border px-2 py-2 text-sm"><option value="inherit">Kế thừa</option><option value="allow">Cấp riêng</option><option value="deny">Chặn riêng</option>
  </select>{state === "allow" ? <select aria-label={`Phạm vi ${permission.name}`} disabled={self || !active} value={override?.scope ?? options[0]}
  onChange={(event) => onSet(permission.code, "allow", event.target.value as Scope)} className="rounded-lg border px-2 py-2 text-sm">{options.map((scope) =>
  <option key={scope} value={scope}>{labels[scope as Scope]}</option>)}</select> : null}</div></div>; })}</section>)}</div></details>;
}

