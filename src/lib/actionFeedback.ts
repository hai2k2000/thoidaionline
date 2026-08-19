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
    error?: string | { code?: string; message?: string };
    message?: string;
  } | null;
  const error = typeof payload?.error === "string"
    ? payload.error
    : payload?.error?.message || payload?.error?.code;
  const labels: Record<string, string> = {
    operation_failed: "Thao tác thất bại.",
    service_unavailable: "Dịch vụ tạm thời chưa sẵn sàng.",
    forbidden: "Bạn không có quyền thực hiện thao tác này.",
    invalid_request: "Dữ liệu gửi lên không hợp lệ.",
    conflict: "Dữ liệu đang xung đột, hãy tải lại trang.",
    not_found: "Không tìm thấy dữ liệu.",
    unauthenticated: "Phiên đăng nhập đã hết hạn.",
  };
  return error ? labels[error] || error : payload?.message || fallback;
}
