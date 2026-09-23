const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

export function getJournalismDepartment(departments) {
  return departments.find((department) => department?.code === "editorial") ?? null;
}

export function serializeVietnamPlannedPublication(date, time) {
  if (!date && !time) return null;
  if (!date || !time) return undefined;
  if (typeof date !== "string" || typeof time !== "string") return null;
  const dateParts = DATE_PATTERN.exec(date);
  const timeParts = TIME_PATTERN.exec(time);
  if (!dateParts || !timeParts) return undefined;
  const year = Number(dateParts[1]);
  const month = Number(dateParts[2]);
  const day = Number(dateParts[3]);
  const hour = Number(timeParts[1]);
  const minute = Number(timeParts[2]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59) return undefined;
  const instant = new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
  return instant.toISOString();
}

export function validateJournalismCreateFields(fields) {
  const errors = {};
  if (!fields.workKindId) errors.workKindId = "required";
  if (typeof fields.location === "string" && [...fields.location].length > 500) errors.location = "max";
  if (typeof fields.editorialNotes === "string" && [...fields.editorialNotes].length > 10000) errors.editorialNotes = "max";
  if (fields.plannedPublicationAt === undefined || (fields.plannedPublicationAt && !Number.isFinite(new Date(fields.plannedPublicationAt).getTime()))) errors.plannedPublicationAt = "invalid";
  return errors;
}

export function buildJournalismCreatePayload(parent, journalism) {
  return {
    ...parent,
    journalism: {
      workKindId: journalism.workKindId,
      plannedPublicationAt: journalism.plannedPublicationAt ?? null,
      location: journalism.location ?? null,
      editorialNotes: journalism.editorialNotes ?? null,
    },
  };
}

export function journalismCreateErrorMessage(code) {
  const labels = {
    inactive_work_kind: "Loại nghiệp vụ này đã ngừng sử dụng. Hãy chọn loại khác.",
    forbidden: "Bạn không có quyền giao công việc này.",
    invalid_request: "Dữ liệu gửi lên chưa hợp lệ. Kiểm tra lại các trường được đánh dấu.",
    operation_failed: "Không thể tạo công việc nghiệp vụ báo chí. Vui lòng thử lại.",
  };
  return labels[code] ?? labels.operation_failed;
}
