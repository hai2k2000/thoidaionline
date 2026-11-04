import { classifyTaskDeadline } from "@/lib/deadlineClassification.mjs";
import { deadlineLabel } from "@/lib/deadlinePresentation.mjs";

export const projectTaskStatuses: Record<string, string> = { new: "Mới", waiting: "Chờ giao", in_progress: "Đang thực hiện", blocked: "Tạm dừng", pending_review: "Chờ duyệt", done: "Hoàn thành", rejected: "Từ chối", cancelled: "Đã hủy" };

export function TaskStatusChip({ status }: { status: string }) {
  const tone = status === "done" ? "bg-emerald-50 text-emerald-800" : status === "pending_review" ? "bg-amber-50 text-amber-800" : status === "cancelled" ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-800";
  return <span className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{projectTaskStatuses[status] ?? status}</span>;
}

export function DeadlineChip({ dueDate }: { dueDate: string | null }) {
  const state = classifyTaskDeadline({ due_date: dueDate, completion_submitted_at: null });
  const tone = state === "overdue" ? "bg-rose-50 text-rose-700" : state === "due_soon" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${tone}`}>{deadlineLabel(state)}</span>;
}

export function ProjectIcon({ kind = "folder" }: { kind?: "folder" | "file" | "link" | "image" | "sheet" }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
    {kind === "folder" ? <path d="M3 7V5h6l2 2h10v12H3V7Z" /> : kind === "link" ? <><path d="M14 3h7v7M21 3l-11 11" /><path d="M10 4H4v16h16v-6" /></> : <><path d="M14 3H5v18h14V8l-5-5ZM14 3v5h5" />{kind === "image" ? <path d="m7 17 3-4 3 3 2-2 2 3M8 10h.01" /> : kind === "sheet" ? <path d="M8 11h8M8 15h8M12 11v7" /> : <path d="M8 12h8M8 16h6" />}</>}
  </svg>;
}
