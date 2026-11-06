export type FeedbackKind = "success" | "error";

export type Feedback = {
  id: string;
  kind: FeedbackKind;
  message: string;
};

export type FeedbackState = { current: Feedback | null };

export type FeedbackAction =
  | { type: "show"; feedback: Feedback }
  | { type: "dismiss" }
  | { type: "timeout" };

export const initialFeedbackState: FeedbackState = { current: null };

export function feedbackReducer(
  state: FeedbackState,
  action: FeedbackAction,
): FeedbackState {
  if (action.type === "show") return { current: action.feedback };
  if (action.type === "dismiss" || action.type === "timeout") {
    return { current: null };
  }
  return state;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function responseErrorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as {
    error?: string | { code?: string; message?: string; field?: string };
    message?: string;
  } | null;
  const error = typeof payload?.error === "string"
    ? payload.error
    : payload?.error?.message || payload?.error?.code;
  const labels: Record<string, string> = {
    operation_failed: "Thao tác thất bại.",
    service_unavailable: "Dịch vụ tạm thời chưa sẵn sàng.",
    forbidden: "Bạn không có quyền thực hiện thao tác này.",
    admin_assignment_participant_forbidden: "Không thể chọn tài khoản quản trị làm người tham gia",
    department_plan_cancel_forbidden: "Công việc đã giao từ kế hoạch phòng ban chỉ Admin mới có quyền huỷ.",
    invalid_request: "Dữ liệu gửi lên không hợp lệ.",
    assignee_department_manager_required: "Phòng của người nhận việc chưa có trưởng phòng",
    reviewer_leadership_required: "Người duyệt phải là Trưởng hoặc Phó phòng.",
    reviewer_department_required: "Người duyệt phải thuộc phòng ban của công việc.",
    reviewer_invalid: "Người duyệt không hợp lệ.",
    conflict: "Dữ liệu đang xung đột, hãy tải lại trang.",
    not_found: "Không tìm thấy dữ liệu.",
    unauthenticated: "Phiên đăng nhập đã hết hạn.",
  };
  if (payload?.error && typeof payload.error === "object" && payload.error.code === "task_changed") {
    const labels: Record<string, string> = { new: "Mới", in_progress: "Đang làm", blocked: "Có vướng mắc", waiting: "Chờ duyệt nhận việc", pending_review: "Chờ duyệt", done: "Hoàn thành", rejected: "Trả lại", cancelled: "Đã hủy" };
    return `Công việc vừa được cập nhật (trạng thái hiện tại: ${labels[(payload.error as { currentStatus?: string }).currentStatus ?? ""] ?? "không xác định"}). Tải lại trang để sửa tiếp.`;
  }
  if (payload?.error && typeof payload.error === "object" && payload.error.field) {
    const fields: Record<string, string> = { title: "Tiêu đề không hợp lệ.", description: "Nội dung không hợp lệ.", startDate: "Ngày bắt đầu không hợp lệ.", start_date: "Ngày bắt đầu không hợp lệ.", dueDate: "Ngày hạn không hợp lệ.", due_date: "Ngày hạn không hợp lệ.", dueTime: "Giờ hạn không hợp lệ.", due_time: "Giờ hạn không hợp lệ.", priority: "Mức độ không hợp lệ.", status: "Trạng thái không hợp lệ.", reason: "Lý do không hợp lệ.", participants: "Người tham gia không hợp lệ.", requirements: "Yêu cầu công việc không hợp lệ.", expectedUpdatedAt: "Phiên sửa đã hết hạn.", task: "Công việc không hợp lệ.", reviewer: "Người duyệt không hợp lệ." };
    return fields[payload.error.field] || fallback;
  }
  return error ? labels[error] || error : payload?.message || fallback;
}
