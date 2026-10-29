"use client";
import { useState } from "react";
import Dialog from "./Dialog";
import type { Scope, UserRow } from "./types";
import { planPresetApplication } from "@/lib/approvalPermissionView.mjs";

type PresetItem = { code: string; scope: string; tier: string; name: string };
type Preset = { label: string; description: string; items: PresetItem[] };
type ApplyResult = { succeeded: string[]; failed: string[] };
type Props = { preset: Preset; user: UserRow; labels: Record<string, string>; saving: boolean; onClose: () => void; onApply: (codes: string[]) => Promise<ApplyResult> };
const scopeLabels: Record<Scope, string> = { self: "Cá nhân", assigned: "Được giao", department: "Phòng ban", all: "Toàn cơ quan" };
const tierLabels = { required: "Bắt buộc", recommended: "Nên có", optional: "Tùy chọn" } as const;
const statusLabels = { already: "Đã có", replace_deny: "Đang chặn riêng → sẽ cấp riêng", grant: "Sẽ cấp riêng" } as const;

export default function PresetDialog({ preset, user, labels, saving, onClose, onApply }: Props) {
  const [selected, setSelected] = useState<string[]>(
    preset.items.filter((item) => item.tier === "recommended").map((item) => item.code),
  );
  const [failure, setFailure] = useState<ApplyResult | null>(null);
  const plan = planPresetApplication(preset, user, selected) as {
    blocked: { message: string } | null;
    items: Array<PresetItem & { status: keyof typeof statusLabels; selected: boolean }>;
    codesToApply: string[];
  };
  const permissionName = (code: string) => labels[code] ?? preset.items.find((item) => item.code === code)?.name ?? code;
  const groups = ["required", "recommended", "optional"] as const;
  return <Dialog title={`Áp dụng gói: ${preset.label}`} onClose={onClose}>
    <p className="mt-2 text-sm text-slate-600">{preset.description}</p>
    <div className="mt-4 space-y-4">{groups.map((tier) => <section key={tier}>
      <h3 className="mb-2 text-sm font-bold">{tierLabels[tier]}</h3>
      <div className="space-y-2">{plan.items.filter((item) => item.tier === tier).map((item) => <label key={item.code} className="flex gap-3 rounded-lg border p-3">
        {tier !== "required" ? <input type="checkbox" checked={item.selected}
          onChange={() => setSelected((current) => current.includes(item.code)
            ? current.filter((code) => code !== item.code) : [...current, item.code])} disabled={saving} /> : null}
        <span className="min-w-0 flex-1"><span className="block font-semibold">{labels[item.code] ?? item.name}</span><code className="block text-xs text-slate-500">{item.code}</code></span>
        <span className="text-right text-xs text-slate-600">
          <span className="block">{scopeLabels[item.scope as Scope]}</span>
          <span className={`mt-1 inline-block rounded-full px-2 py-1 ${item.selected && item.status === "replace_deny"
            ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
            {!item.selected && item.status !== "already" ? "Không cấp" : statusLabels[item.status as keyof typeof statusLabels]}
          </span>
        </span>
      </label>)}</div>
    </section>)}</div>
    <p className="mt-4 text-xs text-slate-600">Gói không cấp quyền duyệt, tự phê duyệt, quản lý quyền hồ sơ hay hồ sơ nhạy cảm.</p>
    <div className="sticky bottom-0 bg-white pt-1">
      {plan.blocked ? <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{plan.blocked.message}</p> : null}
      {failure ? <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
        Đã áp dụng: {failure.succeeded.map(permissionName).join(", ") || "không có"}.
        Chưa áp dụng: {failure.failed.map(permissionName).join(", ")}.
      </p> : null}
      <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onClose}
        className="rounded-lg border px-3 py-2 text-sm font-semibold">Hủy</button>
        <button type="button" disabled={Boolean(plan.blocked) || !plan.codesToApply.length || saving}
          onClick={() => void onApply(plan.codesToApply).then((result) => {
            if (result.failed.length) setFailure(result); else onClose();
          })} className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "Đang áp dụng…" : "Áp dụng gói"}
        </button>
      </div>
    </div>
  </Dialog>;
}
