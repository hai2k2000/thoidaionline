"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

type Props = { taskId: string; canEdit: boolean; canClaim: boolean; terminal: boolean };

export default function PersonalTaskActions({ taskId, canEdit, canClaim, terminal }: Props) {
  const router = useRouter();
  const { notify } = useActionFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const mutate = async (action: "complete" | "cancel", reason?: string) => {
    setBusy(true);
    setError("");
    try { const response = await fetch(`/api/tasks/${taskId}/${action}`, {
      method: "POST",
      headers: reason ? { "Content-Type": "application/json" } : undefined,
      body: reason ? JSON.stringify({ reason }) : undefined,
    });
    if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể cập nhật nhiệm vụ."));
    notify("success", action === "complete" ? "Đã hoàn thành nhiệm vụ." : "Đã hủy nhiệm vụ.");
    router.refresh();
    } catch (error) { const text = errorMessage(error, "Không thể cập nhật nhiệm vụ."); setError(text); notify("error", text); }
    finally { setBusy(false); }
  };

  const claim = async () => {
    setBusy(true);
    setError("");
    try { const response = await fetch("/api/tasks/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể bắt đầu nhiệm vụ."));
    notify("success", "Đã gửi yêu cầu nhận việc. Chờ duyệt.");
    router.refresh();
    } catch (error) { const text = errorMessage(error, "Không thể bắt đầu nhiệm vụ."); setError(text); notify("error", text); }
    finally { setBusy(false); }
  };

  if (terminal) return null;
  if (canClaim && !canEdit) return (
    <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
      <button disabled={busy} onClick={() => void claim()} className="rounded bg-orange-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
        Đăng ký nhận việc
      </button>
      {error ? <span role="alert" className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
  if (!canEdit) return null;
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
        Hủy nhiệm vụ
      </button>
      {error ? <span role="alert" className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
