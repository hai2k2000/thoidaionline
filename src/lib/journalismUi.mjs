export const journalismPublicationStatusLabels = Object.freeze({
  not_published: "Chưa xuất bản",
  scheduled: "Đã lên lịch",
  published: "Đã xuất bản",
  withdrawn: "Đã rút",
});

const PUBLICATION_STATUS_LABELS = journalismPublicationStatusLabels;

export const journalismLabels = Object.freeze({
  topic: "Chủ đề",
  series: "Loạt bài",
  reporter: "Phóng viên",
  publicationStatus: "Trạng thái xuất bản",
  plannedPublicationDate: "Ngày dự kiến xuất bản",
  unplanned: "Chưa lên kế hoạch",
  overdue: "Quá hạn",
  scheduled: "Đã lên lịch",
  published: "Đã xuất bản",
  withdrawn: "Đã rút",
  editorialNotes: "Ghi chú biên tập",
  verification: "Xác minh",
  reconciliation: "Đối soát",
  manualPublicationReport: "Báo cáo xuất bản thủ công",
  journalismTask: "Công việc nghiệp vụ báo chí",
  editorialCalendar: "Lịch nghiệp vụ báo chí",
  journalismReports: "Báo cáo nghiệp vụ báo chí",
});

export const journalismVerificationStatusLabels = Object.freeze({
  unverified: "Chưa xác minh",
  verified: "Đã xác minh",
  rejected: "Bị từ chối",
  stale: "Cần xác minh lại",
});

export const journalismTaskStatusLabels = Object.freeze({
  new: "Mới",
  in_progress: "Đang làm",
  blocked: "Có vướng mắc",
  waiting: "Chờ nhận việc",
  pending_review: "Chờ duyệt",
  rejected: "Trả lại",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
});

export const journalismCalendarStatusLabels = Object.freeze({
  unplanned: journalismLabels.unplanned,
  overdue: journalismLabels.overdue,
  scheduled: journalismLabels.scheduled,
  published: journalismLabels.published,
  withdrawn: journalismLabels.withdrawn,
});

export const journalismPublicationStatusLabel = (status) => PUBLICATION_STATUS_LABELS[status] ?? "Không rõ trạng thái";

export const formatJournalismDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const journalismWorkKindLabel = (workKind) =>
  workKind?.name ? `${workKind.name}${workKind.is_active ? "" : " (Ngừng sử dụng)"}` : "—";

export const safeJournalismArticleUrl = (value) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

export const journalismPublicationStatusClass = (status) => {
  if (status === "published") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "scheduled") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "withdrawn") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
};