export const FOREIGN_REPORTERS = Object.freeze({
  thuphuong: "Tiếng Anh",
  thithuy: "Tiếng Trung",
  ngocanh: "Tiếng Trung",
  minhduc: "Tiếng Lào",
  ducanh: "Tiếng Khmer",
  bachduong: "Tiếng Nga",
});
export const isForeignReporter = (username) => Object.hasOwn(FOREIGN_REPORTERS, String(username ?? "").toLowerCase());
export const reporterLanguageLabel = (username) => FOREIGN_REPORTERS[String(username ?? "").toLowerCase()] ?? "Tiếng Việt";
export const reporterRoleLabel = (username) => `Phóng viên ${reporterLanguageLabel(username)}`;
