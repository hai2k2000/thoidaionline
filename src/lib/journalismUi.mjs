const PUBLICATION_STATUS_LABELS = {
  not_published: "Chưa xuất bản",
  scheduled: "Đã lên lịch",
  published: "Đã xuất bản",
  withdrawn: "Đã gỡ",
};

export const journalismPublicationStatusLabel = (status) =>
  PUBLICATION_STATUS_LABELS[status] ?? "Không rõ trạng thái";

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
