export function validateReportedPublicationUrl(value) {
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return { ok: false };
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) return { ok: false };
    return { ok: true, value: trimmed };
  } catch {
    return { ok: false };
  }
}

export function localDateTime(value) {
  if (!value) return { date: "", time: "" };
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function serializeVietnamPublicationTime(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false };
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day || hour > 23 || minute > 59) return { ok: false };
  const value = new Date(`${date}T${time}:00+07:00`);
  return Number.isFinite(value.getTime()) ? { ok: true, value: value.toISOString() } : { ok: false };
}

export function validatePublishedTitle(value) {
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.normalize("NFC").trim();
  return !trimmed || [...trimmed].length <= 500 ? { ok: true, value: trimmed || null } : { ok: false };
}

export function validatePublicationNote(value) {
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.normalize("NFC").trim();
  return !trimmed || [...trimmed].length <= 5000 ? { ok: true, value: trimmed || null } : { ok: false };
}

export function manualPublicationError(status, code) {
  if (status === 409 || code === "conflict") return { refresh: true, close: true, message: "Thông tin xuất bản đã thay đổi. Dữ liệu mới nhất đã được tải lại." };
  if (status === 403 || code === "forbidden") return { refresh: true, close: true, message: "Bạn không có quyền cập nhật thông tin xuất bản của công việc này." };
  if (status === 404 || code === "not_found") return { refresh: true, close: true, message: "Không tìm thấy công việc báo chí." };
  if (status === 400 || code === "invalid_request") return { refresh: false, close: false, message: "Vui lòng kiểm tra URL, thời gian, tiêu đề và ghi chú." };
  return { refresh: false, close: false, message: "Không thể lưu thông tin xuất bản. Vui lòng thử lại." };
}
