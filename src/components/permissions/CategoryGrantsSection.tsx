"use client";

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CategoryGrant, CategoryGrantLevel } from "./types";

type Props = {
  userId: string;
  active: boolean;
  self: boolean;
  grants: CategoryGrant[];
  setGrants: Dispatch<SetStateAction<CategoryGrant[]>>;
  onChanged?: (userId: string) => void;
  onToast: (message: string) => void;
  onError: (message: string) => void;
};

export default function CategoryGrantsSection({ userId, active, self, grants, setGrants, onChanged, onToast, onError }: Props) {
  const [saving, setSaving] = useState<string[]>([]);

  const updateGrant = async (grant: CategoryGrant, level: CategoryGrantLevel) => {
    const previous = grant.level;
    setSaving((current) => [...current, grant.category_id]);
    setGrants((current) => current.map((item) => item.category_id === grant.category_id ? { ...item, level } : item));
    try {
      const response = await fetch(`/api/permissions/users/${userId}/category-grants`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId: grant.category_id, level }),
      });
      if (!response.ok) throw new Error("Không thể lưu nhóm hồ sơ hạn chế.");
      onChanged?.(userId);
      onToast("Đã lưu nhóm hồ sơ hạn chế.");
    } catch (reason) {
      setGrants((current) => current.map((item) => item.category_id === grant.category_id ? { ...item, level: previous } : item));
      onError(reason instanceof Error ? reason.message : "Không thể lưu nhóm hồ sơ hạn chế.");
    } finally {
      setSaving((current) => current.filter((id) => id !== grant.category_id));
    }
  };

  return <section className="mt-5 rounded-xl border border-slate-200 p-4">
    <h3 className="font-bold">Nhóm hồ sơ hạn chế</h3>
    <p className="text-xs text-slate-500">Không / Xem / Đóng góp / Duyệt</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {grants.map((grant) => <label key={grant.category_id} className="flex items-center justify-between gap-2 text-sm">
        {grant.db_categories?.name ?? grant.category_id}
        <select
          value={grant.level}
          disabled={!active || self || saving.includes(grant.category_id)}
          onChange={(event) => void updateGrant(grant, event.target.value as CategoryGrantLevel)}
          className="rounded border px-2 py-1 disabled:opacity-50"
        >
          <option value="none">Không</option>
          <option value="view">Xem</option>
          <option value="contribute">Đóng góp</option>
          <option value="approve">Duyệt</option>
        </select>
      </label>)}
    </div>
  </section>;
}
