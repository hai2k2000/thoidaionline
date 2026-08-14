type ResettableEmployee = { active: boolean; email: string | null };

const RESET_MESSAGES: Record<string, string> = {
  email_missing: "Nhân viên chưa có email đăng ký.",
  user_inactive: "Không thể đặt lại mật khẩu cho tài khoản đã khóa.",
  reset_email_sent: "Đã gửi liên kết đặt lại mật khẩu. Liên kết có hiệu lực trong 60 phút.",
  invalid_request: "Yêu cầu đặt lại mật khẩu không hợp lệ.",
  unauthenticated: "Phiên đăng nhập không hợp lệ.",
  forbidden: "Chỉ Admin được đặt lại mật khẩu nhân viên.",
  user_not_found: "Không tìm thấy nhân viên.",
  reset_prepare_failed: "Không thể chuẩn bị yêu cầu đặt lại mật khẩu.",
  audit_finalize_failed: "Không thể hoàn tất nhật ký gửi email.",
  email_delivery_failed: "Không thể gửi email đặt lại mật khẩu.",
  network_error: "Không thể gửi liên kết đặt lại mật khẩu.",
};

export function getPasswordResetDisabledReason(
  employee: ResettableEmployee,
  submitting: boolean,
) {
  if (!employee.active) return RESET_MESSAGES.user_inactive;
  if (!employee.email?.trim()) return RESET_MESSAGES.email_missing;
  if (submitting) return "Đang gửi liên kết đặt lại mật khẩu.";
  return null;
}

export const passwordResetMessage = (code: string) =>
  RESET_MESSAGES[code] ?? "Không thể gửi liên kết đặt lại mật khẩu.";
