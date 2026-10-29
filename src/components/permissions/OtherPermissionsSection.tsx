"use client";
import { useMemo, useState } from "react";
import { APPROVAL_PERMISSION_CODES, groupPermissions } from "@/lib/approvalPermissionView.mjs";
import type { PermissionModule, Scope, UserRow } from "./types";
const labels: Record<Scope, string> = { self: "Cá nhân", assigned: "Được giao", department: "Phòng ban", all: "Toàn cơ quan" };
type ViewPermission = { code: string; name?: string };
type Group = { key: string; label: string; permissions: ViewPermission[] };
type Props = {
  user: UserRow;
  modules: PermissionModule[];
  active: boolean;
  self: boolean;
  scopeOptions?: Record<string, Scope[]>;
  pending?: string[];
  onSet: (code: string, value: string, scope?: Scope) => void;
};
export default function OtherPermissionsSection({ user, modules, active, self, scopeOptions, pending = [], onSet }: Props) {
  const [query, setQuery] = useState(""); const [open, setOpen] = useState<Record<string, boolean>>({});
  const permissions = useMemo(() => modules.flatMap((module) => module.permissions).filter((permission) => !APPROVAL_PERMISSION_CODES.includes(permission.code)), [modules]);
  const groups = groupPermissions(permissions as never) as Group[];
  return <section className="mt-5 rounded-xl border border-slate-200">
    <div className="border-b px-4 py-3 text-sm font-extrabold uppercase tracking-wide">Các quyền khác</div>
    <div className="space-y-2 p-4">
      <label className="block text-sm font-semibold">Tìm quyền
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      {groups.map((group) => {
        const visible = group.permissions.filter((permission) => `${permission.name} ${permission.code}`.toLowerCase().includes(query.toLowerCase()));
        if (!visible.length) return null;
        const expanded = query.trim() ? true : Boolean(open[group.key]);
        const deviations = visible.filter((permission) => user.overrides?.[permission.code]);
        const allows = deviations.filter((permission) => user.overrides?.[permission.code]?.effect === "allow").length;
        const id = `permission-group-${group.key}`;
        return <section key={group.key} className="overflow-hidden rounded-lg border border-slate-200">
          <button type="button" aria-expanded={expanded} aria-controls={id}
            onClick={() => setOpen((state) => ({ ...state, [group.key]: !expanded }))}
            className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-bold">
            <span>{group.label} ({visible.length}) <span className="text-xs font-normal text-slate-500">
              {deviations.length
                ? [allows ? `${allows} cấp riêng` : "", deviations.length - allows ? `${deviations.length - allows} chặn riêng` : ""]
                  .filter(Boolean)
                  .join(" · ")
                : "Mặc định"}
            </span></span>
            <span aria-hidden="true" className={expanded ? "rotate-180" : ""}>⌄</span>
          </button>
          {expanded ? <div id={id} className="px-3">{visible.map((permission) => <PermissionRow
            key={permission.code} permission={permission} user={user} active={active} self={self}
            scopeOptions={scopeOptions} busy={pending.includes(permission.code)} onSet={onSet} />)}</div> : null}
        </section>;
      })}
    </div>
  </section>;
}
type RowProps = { permission: ViewPermission; user: UserRow; active: boolean; self: boolean;
  scopeOptions?: Record<string, Scope[]>; busy: boolean;
  onSet: (code: string, value: string, scope?: Scope) => void };
function PermissionRow({ permission, user, active, self, scopeOptions, busy, onSet }: RowProps) {
  const override = user.overrides?.[permission.code]; const state = override?.effect ?? "inherit"; const options = scopeOptions?.[permission.code] ?? ["self", "assigned", "department", "all"];
  return <div className="grid gap-3 border-t py-3 md:grid-cols-[1fr_auto]"><div>
    <b>{permission.name}</b><p className="font-mono text-xs text-slate-500">{permission.code}</p>
  </div><div className="flex flex-wrap items-center gap-2"><select aria-label={`Thiết lập: ${permission.name}`}
    disabled={self || !active || busy} value={state}
    onChange={(event) => onSet(permission.code, event.target.value, override?.scope)}
    className="rounded-lg border px-2 py-2 text-sm"><option value="inherit">Kế thừa</option>
    <option value="allow">Cấp riêng</option><option value="deny">Chặn riêng</option></select>
    {state === "allow" ? <select disabled={self || !active || busy} value={override?.scope ?? options[0]}
      onChange={(event) => onSet(permission.code, "allow", event.target.value as Scope)}
      className="rounded-lg border px-2 py-2 text-sm">{options.map((scope) => <option key={scope}
        value={scope}>{labels[scope as Scope]}</option>)}</select> : null}
    {busy ? <span className="text-xs text-slate-500">Đang lưu…</span> : null}</div></div>;
}
