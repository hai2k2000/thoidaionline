export function publicationActions(status) {
  if (status === "not_published") return ["schedule", "publish"];
  if (status === "scheduled") return ["cancel_schedule", "publish"];
  if (status === "published") return ["withdraw"];
  return [];
}

export function validateSchedule(date, time, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false };
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day || hour > 23 || minute > 59) return { ok: false };
  const value = `${date}T${time}:00+07:00`;
  return new Date(value) > now ? { ok: true, value } : { ok: false, reason: "past" };
}

export function validateArticleUrl(value) {
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return { ok: false };
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) return { ok: false };
    return { ok: true, value: parsed.toString() };
  } catch {
    return { ok: false };
  }
}

export function validateWithdrawalReason(value) {
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.normalize("NFC").trim();
  return trimmed && [...trimmed].length <= 2000 ? { ok: true, value: trimmed } : { ok: false };
}

export function buildPublicationRequest(action, values) {
  if (action === "schedule") return { status: "scheduled", plannedPublicationAt: values.plannedPublicationAt };
  if (action === "cancel_schedule") return { status: "not_published" };
  if (action === "publish") return { status: "published", articleUrl: values.articleUrl.trim() };
  if (action === "withdraw") return { status: "withdrawn", reason: values.reason.normalize("NFC").trim() };
  return null;
}

export function publicationError(status, code, action = "") {
  if (status === 409 || code === "publication_state_conflict") return { refresh: true, close: true, message: "Trạng thái xuất bản đã thay đổi. Dữ liệu mới nhất đã được tải lại." };
  if (status === 403 || code === "forbidden") return { refresh: true, close: true, message: "Bạn không có quyền thay đổi trạng thái xuất bản của công việc này." };
  if (status === 404 || code === "not_found") return { refresh: true, close: true, message: "Không tìm thấy thông tin nghiệp vụ báo chí." };
  if (status === 400 || code === "invalid_request") {
    if (action === "schedule") return { refresh: false, close: false, message: "Cần nhập thời gian dự kiến xuất bản để lên lịch." };
    if (action === "publish") return { refresh: false, close: false, message: "URL phải là địa chỉ http/https hợp lệ, không chứa thông tin đăng nhập." };
    if (action === "withdraw") return { refresh: false, close: false, message: "Vui lòng nhập lý do gỡ bài." };
  }
  return { refresh: false, close: false, message: "Không thể hoàn tất thao tác xuất bản. Vui lòng thử lại." };
}
