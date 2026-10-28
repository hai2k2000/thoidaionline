"use client";
import { APPROVAL_PERMISSION_CODES, APPROVAL_PERMISSION_LABELS, previewSentence } from "@/lib/approvalPermissionView.mjs";
import type { PermissionItem } from "./types";
export default function ApprovalPermissionsCard({ items, active, self, onSet, userName }: {
    items: PermissionItem[];
    active: boolean;
    self: boolean;
    onSet: (item: PermissionItem, value: string) => void;
    onGrant: (item: PermissionItem) => void;
    onRevoke: (item: PermissionItem) => void;
    userName: string;
}) {
    const approvalItems = APPROVAL_PERMISSION_CODES.map((code) => items.find((item) => item.permissionCode === code) ?? ({ permissionCode: code,
  label: APPROVAL_PERMISSION_LABELS[code as keyof typeof APPROVAL_PERMISSION_LABELS] } as PermissionItem));
    return <section><h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide">PHÊ DUYỆT ĐƠN VÀ KẾ HOẠCH</h3>{approvalItems.map((item) =>
  <div key={item.permissionCode} className="border-t py-4"><b>{item.label ?? item.permissionCode}</b>
  <select disabled={self || !active} value={item.userEffect ?? "inherit"} onChange={(event) => onSet(item, event.target.value)} className="ml-3 rounded-lg border px-2 py-2">
  <option value="inherit">Kế thừa</option><option value="allow">Cấp riêng</option><option value="deny">Chặn riêng</option></select>
  </div>)}<p className="mt-4 rounded-lg bg-orange-50 p-3 text-sm">{previewSentence(approvalItems, userName, { active })}</p></section>;
}

