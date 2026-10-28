"use client";
import { useState } from "react";
import Dialog from "./Dialog";
import type { PermissionItem } from "./types";
export default function RevokeDialog({ item, onClose, onSubmit }: {
  item: PermissionItem;
  onClose: () => void;
  onSubmit: (mode: "clear" | "deny") => Promise<void>;
}) {
  const [mode, setMode] = useState<"clear" | "deny">("clear");
  return <Dialog title="Thay đổi quyền riêng" onClose={onClose}>
    <p className="mt-3 text-sm text-slate-600">{item.label ?? item.permissionCode}</p>
    <div className="mt-4 space-y-3">
      <label className="flex gap-2"><input type="radio" name="revoke" checked={mode === "clear"} onChange={() => setMode("clear")}/>Khôi phục mặc định</label>
      <label className="flex gap-2"><input type="radio" name="revoke" checked={mode === "deny"} onChange={() => setMode("deny")}/>Chặn riêng</label>
    </div>
    <button type="button" onClick={() => void onSubmit(mode)} className="mt-4 w-full rounded-xl bg-orange-600 px-4 py-2 font-bold text-white">Xác nhận</button>
  </Dialog>;
}
