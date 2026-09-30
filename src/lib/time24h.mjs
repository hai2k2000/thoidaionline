export const TIME_24H_PATTERN = "(?:[01][0-9]|2[0-3]):[0-5][0-9]";
export const TIME_24H_REGEX = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
export const TIME_24H_ERROR_MESSAGE = "Vui lòng nhập giờ theo định dạng HH:mm, từ 00:00 đến 23:59.";

export function isValidTime24h(value) {
  return typeof value === "string" && TIME_24H_REGEX.test(value);
}
