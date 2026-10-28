"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { historyLine } from "@/lib/approvalPermissionView.mjs";
import Dialog from "./Dialog";
export default function PermissionHistoryDrawer({ userId, onClose }: {
    userId: string;
    onClose: () => void;
}) { const [items, setItems] = useState<unknown[]>([]); const [before, setBefore] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const load = useCallback(async () => { setLoading(true); const query = before ? `&before=${encodeURIComponent(before)}` : "";
  const response = await fetch(`/api/permissions/users/${userId}/history?limit=30${query}`, { cache: "no-store" }); const data = await response.json().catch(() => ({})); if (!response.ok)
    setError("Không thể tải lịch sử.");
else {
    setItems((current) => [...current, ...(data.items ?? [])]);
    setBefore(data.nextBefore ?? null);
} setLoading(false); }, [before, userId]); useEffect(() => void load(), [load]);
  return <Dialog title="Lịch sử thay đổi" onClose={onClose} fullScreen>
  <div className="mt-4 max-h-[75vh] space-y-3 overflow-y-auto">{loading && !items.length ? <p>Đang tải…</p> : null}{!loading && !items.length &&
  !error ? <p>Chưa có lịch sử.</p> : null}{error ? <p role="alert">{error}</p> : null}{items.map((entry, index) =>
  <p key={`${index}`} className="rounded-lg bg-slate-50 p-3 text-sm">{historyLine(entry as never)}</p>)}</div>{before ? <button type="button" disabled={loading} onClick={() => void load()}
  className="mt-4 w-full rounded-xl border px-4 py-2 font-semibold">Tải thêm</button> : null}</Dialog>; }

