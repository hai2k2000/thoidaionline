"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import type { JournalismStructureSeries } from "@/lib/journalismStructureRepository";

type Item = { taskId: string; title: string; position: number; canView: boolean };

export default function JournalismSeriesOrderShell({ userLabel, series, items: initialItems, hasHiddenItems, canManage }: { userLabel: string; series: JournalismStructureSeries; items: Item[]; hasHiddenItems: boolean; canManage: boolean }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { notify } = useActionFeedback();
  const [items] = useState<Item[]>(initialItems);
  const [busy, setBusy] = useState(false);
  const allVisible = !hasHiddenItems;
  const move = async (index: number, delta: -1 | 1) => {
    if (busy || !allVisible) return;
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    try {
      const response = await fetch(`/api/journalism/series/${series.id}/order`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskIds: next.map((item) => item.taskId) }) });
      if (response.status === 409) { notify("error", "Thứ tự hoặc thành viên của loạt bài đã thay đổi. Dữ liệu mới nhất đã được tải lại."); router.refresh(); return; }
      if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể cập nhật thứ tự."));
      notify("success", "Đã cập nhật thứ tự."); router.refresh();
    } catch (error) { notify("error", errorMessage(error, "Không thể cập nhật thứ tự.")); }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 lg:flex-row lg:gap-4"><AppNav currentPath={`/journalism/structures/${series.id}`} userLabel={userLabel} onLogout={() => { void logout().then(() => router.replace("/login")); }} /><main className="min-w-0 flex-1"><header className="rounded-2xl border bg-white p-4 shadow-sm"><h1 className="text-2xl font-bold">Thứ tự loạt bài: {series.name}</h1><p className="mt-1 text-sm text-slate-600">Chỉ các công việc bạn được xem mới được hiển thị.</p></header>{!allVisible ? <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">Không thể sắp xếp vì loạt bài có công việc ngoài phạm vi bạn được xem.</p> : null}<section className="mt-3 space-y-2 rounded-xl border bg-white p-4">{items.length ? items.map((item, index) => <div key={item.taskId} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><span className="w-8 text-center font-bold">{index + 1}</span><span className="min-w-0 flex-1 break-words font-semibold">{item.title}</span>{canManage && allVisible ? <div className="flex gap-2"><button type="button" disabled={busy || index === 0} aria-label={`Đưa ${item.title} lên`} onClick={() => move(index, -1)} className="min-h-11 rounded-lg border px-3 py-2 font-semibold disabled:opacity-40">Lên</button><button type="button" disabled={busy || index === items.length - 1} aria-label={`Đưa ${item.title} xuống`} onClick={() => move(index, 1)} className="min-h-11 rounded-lg border px-3 py-2 font-semibold disabled:opacity-40">Xuống</button></div> : null}</div>) : <p className="p-4 text-center text-slate-600">Chưa có công việc trong loạt bài hoặc dữ liệu đang được tải lại.</p>}</section></main></div></div>;
}
