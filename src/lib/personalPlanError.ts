export type PersonalPlanErrorCode =
  | "invalid_origin"
  | "unauthenticated"
  | "forbidden"
  | "invalid_request"
  | "not_found"
  | "conflict"
  | "service_unavailable"
  | "operation_failed";

const MESSAGES: Record<PersonalPlanErrorCode, string> = {
  invalid_origin: "Yêu cầu không hợp lệ. Vui lòng tải lại trang rồi thử lại.",
  unauthenticated: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  forbidden: "Bạn không có quyền thực hiện thao tác này.",
  invalid_request: "Thông tin kế hoạch chưa hợp lệ. Vui lòng kiểm tra ngày, giờ và tiêu đề.",
  not_found: "Không tìm thấy kế hoạch cần thao tác.",
  conflict: "Kế hoạch đã thay đổi. Vui lòng tải lại trang rồi thử lại.",
  service_unavailable: "Dịch vụ đang bận. Vui lòng thử lại sau.",
  operation_failed: "Không thể lưu kế hoạch lúc này. Vui lòng thử lại.",
};

export function personalPlanErrorMessage(code: unknown) {
  return typeof code === "string" && code in MESSAGES
    ? MESSAGES[code as PersonalPlanErrorCode]
    : "Không thể tạo kế hoạch. Vui lòng kiểm tra lại thông tin.";
}
