"use client";
import { useState } from "react";
import { APPROVAL_PERMISSION_LABELS, defaultGrantScope, isNarrowingAllow, requiresTypedConfirmation } from "@/lib/approvalPermissionView.mjs";
import Dialog from "./Dialog";
import type { PermissionItem, Scope } from "./types";
const scopes: Record<Scope, string> = { self: "Cá nhân", assigned: "Được giao / liên quan", department: "Phòng ban", all: "Toàn cơ quan" };
export default function GrantDialog({ item, allowedScopes = ["department", "all"], onClose, onSubmit }: {
    item: PermissionItem;
    allowedScopes?: Scope[];
    onClose: () => void;
    onSubmit: (scope: Scope) => Promise<void>;
}) {
    const [scope, setScope] = useState<Scope>((defaultGrantScope(item.permissionCode) as Scope | null) ?? allowedScopes[0]);
    const [confirmation, setConfirmation] = useState("");
    const narrowing = isNarrowingAllow([...(item.roleScopes ?? []), ...(item.structuralScopes ?? [])] as never[], [], scope as never);
    const needsConfirmation = requiresTypedConfirmation("allow", scope);
    return <Dialog title="Cấp riêng quyền" onClose={onClose}>
  <p className="mt-3 text-sm text-slate-600">{item.label ?? APPROVAL_PERMISSION_LABELS[item.permissionCode as keyof typeof APPROVAL_PERMISSION_LABELS] ?? item.permissionCode}</p>
  <fieldset className="mt-4 space-y-2"><legend className="text-sm font-semibold">Phạm vi</legend>{allowedScopes.map((value) => <label key={value} className="flex items-center gap-2">
  <input type="radio" name="grant-scope" value={value} checked={scope === value}
  onChange={() => setScope(value)}/>{scopes[value]}</label>)}</fieldset>{narrowing ?
  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Phạm vi này hẹp hơn quyền kế thừa và sẽ thay thế quyền đó.</p> : null}{needsConfirmation ?
  <label className="mt-3 block text-sm">Gõ <b>TOAN CO QUAN</b> để xác nhận<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
  className="mt-1 w-full rounded-lg border px-3 py-2"/>
  </label> : null}<button type="button" disabled={needsConfirmation && confirmation !== "TOAN CO QUAN"} onClick={() => void onSubmit(scope)}
  className="mt-4 w-full rounded-xl bg-orange-600 px-4 py-2 font-bold text-white disabled:opacity-50">Lưu cấp riêng</button></Dialog>;
}

