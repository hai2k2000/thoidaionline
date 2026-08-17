"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { taskId: string; canEdit: boolean; terminal: boolean };

export default function PersonalTaskActions({ taskId, canEdit, terminal }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const mutate = async (action: "complete" | "cancel", reason?: string) => {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/tasks/${taskId}/${action}`, {
      method: "POST",
      headers: reason ? { "Content-Type": "application/json" } : undefined,
      body: reason ? JSON.stringify({ reason }) : undefined,
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError("Không thể cập nhật nhiệm vụ. Vui lòng thử lại.");
      return;
    }
    router.refresh();
  };

  if (!canEdit || terminal) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
      <Link href={`/tasks/personal/${taskId}/edit`} className="rounded border px-2 py-1 text-xs font-semibold">
        Sửa
      </Link>
      <button disabled={busy} onClick={() => mutate("complete")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
        Hoàn thành
      </button>
      <button
        disabled={busy}
        onClick={() => {
          const reason = window.prompt("Lý do hủy nhiệm vụ");
          if (reason?.trim()) void mutate("cancel", reason.trim());
        }}
        className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-50"
      >
        Hủy
      </button>
      {error ? <span role="alert" className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}