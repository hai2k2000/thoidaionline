export const TIME_24H_PATTERN = "(?:[01][0-9]|2[0-3]):[0-5][0-9]";
export const TIME_24H_REGEX = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
export const TIME_24H_ERROR_MESSAGE = "Vui lòng nhập giờ theo định dạng HH:mm, từ 00:00 đến 23:59.";

export function isValidTime24h(value) {
  return typeof value === "string" && TIME_24H_REGEX.test(value);
}

export function formatTime24hInput(value) {
  const input = typeof value === "string" ? value : "";
  const colonIndex = input.indexOf(":");

  if (colonIndex >= 0) {
    const hours = input.slice(0, colonIndex).replace(/\D/g, "").slice(0, 2);
    const minutes = input.slice(colonIndex + 1).replace(/\D/g, "").slice(0, 2);
    return hours ? `${hours}:${minutes}` : minutes;
  }

  const digits = input.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export function time24hCaretPosition(rawValue, selectionStart) {
  const prefix = String(rawValue ?? "").slice(0, Math.max(0, selectionStart ?? 0));
  return formatTime24hInput(prefix).length;
}
