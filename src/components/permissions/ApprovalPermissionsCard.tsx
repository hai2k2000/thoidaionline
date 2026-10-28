"use client";
import { APPROVAL_PERMISSION_CODES, APPROVAL_PERMISSION_LABELS, SOURCE_LABELS, previewSentence } from "@/lib/approvalPermissionView.mjs";
import type { PermissionItem } from "./types";
const dateText = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
}).format(new Date(value)) : "—";
const scopeText = (scope: string, item: PermissionItem) => scope === "department" ? `Phòng ${item.effectiveDepartment?.name ?? "ban"}` : scope === "all" ? "Toàn cơ quan" : scope;
export default function ApprovalPermissionsCard({ items, active, self, onGrant, onRevoke, userName }: {
  items: PermissionItem[]; active: boolean; self: boolean; onSet: (item: PermissionItem, value: string) => void;
  onGrant: (item: PermissionItem) => void; onRevoke: (item: PermissionItem) => void; userName: string;
}) {
  const approvalItems = APPROVAL_PERMISSION_CODES.map((code) => items.find((item) => item.permissionCode === code) ?? ({
    permissionCode: code,
    label: APPROVAL_PERMISSION_LABELS[code as keyof typeof APPROVAL_PERMISSION_LABELS],
  } as PermissionItem));
  return <section><h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide">PHÊ DUYỆT ĐƠN VÀ KẾ HOẠCH</h3>
    {approvalItems.map((item) => <div key={item.permissionCode} className="border-t py-4">
    <b>{item.label ?? item.permissionCode}</b>
    <select aria-label={`Thiết lập: ${item.label ?? item.permissionCode}`} disabled={self || !active}
      value={item.userEffect ?? "inherit"}
      onChange={(event) => event.target.value === "allow" ? onGrant(item) : onRevoke(item)}
      className="ml-3 rounded-lg border px-2 py-2">
      <option value="inherit">Kế thừa</option><option value="allow">Cấp riêng</option><option value="deny">Chặn riêng</option>
    </select>
    <div className="mt-2 space-y-1 text-sm text-slate-600">
      <p>Mặc định: {(item.roleScopes ?? []).join(", ") || "Không có"}{item.structuralScopes?.length ? ` · ${item.structuralScopes.join(", ")} (${SOURCE_LABELS.structural})` : ""}</p>
      <p>Hiệu lực: {(item.effectiveScopes ?? []).map((scope) => scopeText(scope, item)).join(", ") || "Không có"} ·
        {SOURCE_LABELS[item.source as keyof typeof SOURCE_LABELS] ?? item.source ?? SOURCE_LABELS.none}</p>
      {item.userEffect ? <p>Cấp bởi {item.grantedBy?.name ?? "—"} lúc {dateText(item.grantedAt)}</p> : null}
      {(item.restrictions ?? []).map((restriction) => <p key={restriction}>
        {restriction === "leave_ge_3_days_tbt_only" ? "Đơn từ 3 ngày trở lên chỉ Tổng biên tập duyệt." : restriction}
      </p>)}
    </div><button type="button" disabled={self || !active || !item.userEffect}
      onClick={() => onRevoke(item)} className="mt-2 rounded-lg border px-2 py-1 text-sm font-semibold disabled:opacity-50">Khôi phục</button>
  </div>)}<p className="mt-4 rounded-lg bg-orange-50 p-3 text-sm">{previewSentence(approvalItems, userName, { active })}</p></section>;
}
