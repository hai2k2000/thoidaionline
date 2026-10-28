"use client";
import { useState } from "react";
import { APPROVAL_PERMISSION_LABELS, defaultGrantScope, isNarrowingAllow, previewSentence, requiresTypedConfirmation } from "@/lib/approvalPermissionView.mjs";
import Dialog from "./Dialog";
import type { PermissionItem, Scope } from "./types";
const scopes: Record<Scope, string> = { self: "Cá nhân", assigned: "Được giao / liên quan", department: "Phòng ban", all: "Toàn cơ quan" };
export default function GrantDialog({ item, userName, departmentName, active = true, allowedScopes = ["department", "all"], onClose, onSubmit }: {
    item: PermissionItem;
    userName: string;
    departmentName?: string | null;
    active?: boolean;
    allowedScopes?: Scope[];
    onClose: () => void;
    onSubmit: (scope: Scope) => Promise<void>;
}) {
    const [scope, setScope] = useState<Scope>((defaultGrantScope(item.permissionCode) as Scope | null) ?? allowedScopes[0]);
    const [confirmation, setConfirmation] = useState("");
    const narrowing = isNarrowingAllow([...(item.roleScopes ?? []), ...(item.structuralScopes ?? [])] as never[], [], scope as never);
    const needsConfirmation = requiresTypedConfirmation("allow", scope);
    const previewItem = { ...item, effectiveScopes: [scope], effectiveDepartment: { name: departmentName ?? "phòng ban của mình" } };
    return <Dialog title="Cấp riêng quyền" onClose={onClose}>
  <p className="mt-3 text-sm text-slate-600">Người được cấp: <b>{userName}</b> · {departmentName ?? "Chưa có phòng ban"}</p>
  <p className="mt-3 text-sm text-slate-600">{item.label ?? APPROVAL_PERMISSION_LABELS[item.permissionCode as keyof typeof APPROVAL_PERMISSION_LABELS] ?? item.permissionCode}</p>
  <fieldset className="mt-4 space-y-2"><legend className="text-sm font-semibold">Phạm vi</legend>{allowedScopes.map((value) => <label key={value} className="flex items-center gap-2">
  <input type="radio" name="grant-scope" value={value} checked={scope === value}
  onChange={() => setScope(value)}/>{scopes[value]}</label>)}</fieldset>{narrowing ?
  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Phạm vi này hẹp hơn quyền kế thừa và sẽ thay thế quyền đó.</p> : null}{scope === "all" ?
  <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">Người này sẽ duyệt được hồ sơ của MỌI phòng ban.</p> : null}{needsConfirmation ?
  <label className="mt-3 block text-sm">Gõ <b>TOAN CO QUAN</b> để xác nhận<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
  className="mt-1 w-full rounded-lg border px-3 py-2"/>
  </label> : null}<p className="mt-3 rounded-lg bg-orange-50 p-3 text-sm">
    {previewSentence([previewItem], userName, { active })}</p>
  <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose}
    className="rounded-xl border px-4 py-2 font-bold">Hủy</button><button type="button"
    disabled={needsConfirmation && confirmation !== "TOAN CO QUAN"} onClick={() => void onSubmit(scope)}
    className="rounded-xl bg-orange-600 px-4 py-2 font-bold text-white disabled:opacity-50">
    Lưu cấp riêng</button></div></Dialog>;
}

