export const statusLabels = {
  draft: "Nháp",
  pending_review: "Chờ duyệt",
  approved: "Đã duyệt",
  archived: "Đã lưu trữ",
  deleted: "Đã xóa",
};

export const languageLabels = {
  vi: "Tiếng Việt",
  en: "Tiếng Anh",
  zh: "Tiếng Trung",
  lo: "Tiếng Lào",
  km: "Tiếng Campuchia (Khmer)",
};

export function presentLanguage(code) {
  return code ? languageLabels[code] ?? code : "Chưa xác định";
}

export function presentStatus(status) {
  return statusLabels[status] ?? status;
}

export function presentRecordType(type) {
  return type?.name || type?.code || "Chưa xác định";
}

export function getVisibleRecordCount(rows) {
  const reported = rows.find((row) => Number.isFinite(Number(row?.total_count)))?.total_count;
  return reported === undefined ? rows.length : Number(reported);
}

export function hasActiveRecordFilters({ query, languageCode, status }) {
  return Boolean(query.trim() || languageCode || status);
}
