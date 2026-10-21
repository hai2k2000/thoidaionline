export const statusLabels = {
  draft: "Nháp",
  pending_review: "Chờ duyệt",
  approved: "Đã duyệt",
  archived: "Đã lưu trữ",
  deleted: "Đã xóa",
};

export const statusToneClasses = {
  draft: "bg-slate-100 text-slate-700",
  pending_review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  archived: "bg-violet-100 text-violet-800",
  deleted: "bg-rose-100 text-rose-800",
};

export const languageLabels = {
  vi: "Tiếng Việt",
  en: "Tiếng Anh",
  zh: "Tiếng Trung",
  lo: "Tiếng Lào",
  km: "Tiếng Campuchia (Khmer)",
};

export const categoryLabels = {
  tong_hop: "Phòng Tổng hợp",
  truyen_thong: "Phòng Truyền thông",
  phong_noi_dung: "Phòng Nội dung",
  doan_the_quan_ly: "Tổ chức đoàn thể và hồ sơ quản lý chuyên biệt",
  ngoai_ngu: "Các tổ Ngoại ngữ",
};

export function presentLanguage(code) {
  return code ? languageLabels[code] ?? code : "Chưa xác định";
}

export function presentCategory(category) {
  return category?.name || categoryLabels[category?.code] || category?.code || "Chưa xác định";
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

export function getTotalPages(totalCount, pageSize) {
  const total = Math.max(Number(totalCount) || 0, 0);
  const size = Math.max(Number(pageSize) || 1, 1);
  return Math.max(1, Math.ceil(total / size));
}

export function hasActiveRecordFilters({ query, categoryId, languageCode, status }) {
  return Boolean(query.trim() || categoryId || languageCode || status);
}
