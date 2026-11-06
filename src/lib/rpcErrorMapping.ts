import type { ApiErrorCode } from "./apiResponse";

export type RpcError = {
  code?: string | null;
  details?: string | null;
  detail?: string | null;
  message?: string | null;
  hint?: string | null;
};

export type RpcErrorMapping = {
  code: ApiErrorCode;
  status: number;
  field?: string;
};

export function mapRpcError(error: RpcError): RpcErrorMapping {
  if (error.hint?.startsWith("admin_edit.task_changed") || error.message === "Task changed while editing.") {
    return { code: "task_changed", status: 409 };
  }
  if (error.hint?.startsWith("admin_edit.")) {
    const field = error.hint.slice("admin_edit.".length).replace(/^status_requires_.+$/, "status");
    return { code: "invalid_request", status: 400, field };
  }
  if (error.message === "Người duyệt không hợp lệ.") return { code: "reviewer_invalid", status: 400, field: "reviewer" };
  if (error.message === "Reviewer must be an active project lead or admin.") return { code: "reviewer_invalid", status: 400, field: "reviewer" };
  if (error.message === "Only the creator may mutate an unapproved task.") return { code: "forbidden", status: 403, field: "task" };
  if (error.message === "Cancelled task cannot be mutated.") return { code: "forbidden", status: 403, field: "status" };
  if (error.message === "Admin participant edit forbidden.") return { code: "forbidden", status: 403, field: "participants" };
  if (error.message === "Only assigned tasks support participant edits.") return { code: "invalid_request", status: 400, field: "participants" };
  if (error.message === "Invalid participant roles." || error.message === "Inactive participant." || error.message === "Project participant or reviewer is invalid.") {
    return { code: "invalid_request", status: 400, field: "participants" };
  }
  if (error.message === "mutation policy unavailable" || error.message === "Task creator identity unavailable." || error.message === "Task lifecycle state unavailable." || error.message === "Invalid task actor.") {
    return { code: "forbidden", status: 403, field: "task" };
  }
  if (error.message === "Use report/review for completion transitions.") return { code: "invalid_request", status: 400, field: "status" };
  if (error.message === "Invalid task priority.") return { code: "invalid_request", status: 400, field: "priority" };
  if (error.code === "42501" && error.message === "Người duyệt phải là Trưởng hoặc Phó phòng.") {
    return { code: "reviewer_leadership_required", status: 403 };
  }
  if (error.code === "42501" && error.message === "Người duyệt phải thuộc phòng ban của công việc.") {
    return { code: "reviewer_department_required", status: 403 };
  }
  if (error.code === "22023" && error.message === "Người duyệt không hợp lệ.") {
    return { code: "reviewer_invalid", status: 400 };
  }
  if (error.code === "22023" && (
    error.message === "Assignee department requires an active primary manager."
    || error.message === "Assigned participant requires an active department."
    || error.message === "Phòng của người nhận việc chưa có trưởng phòng"
  )) {
    return { code: "assignee_department_manager_required", status: 400 };
  }
  if (error.message === "Công việc đã giao từ kế hoạch phòng ban chỉ Admin mới có quyền huỷ.") {
    return { code: "department_plan_cancel_forbidden", status: 403 };
  }
  if (error.message === "Publication state conflict.") {
    return { code: "publication_state_conflict", status: 409 };
  }
  if (
    error.code === "40001"
    || error.code === "55000"
    || error.details === "40001"
    || error.details === "55000"
    || error.message === "Publication report changed before verification."
  ) {
    return { code: "conflict", status: 409 };
  }
  switch (error.code) {
    case "42501":
      if (error.message === "Admin cannot be an assignment participant.") {
        return { code: "admin_assignment_participant_forbidden", status: 403 };
      }
      return { code: "forbidden", status: 403 };
    case "P0002":
      return { code: "not_found", status: 404 };
    case "22023":
    case "22007":
    case "23514":
      return { code: "invalid_request", status: 400 };
    case "23505":
      return { code: "conflict", status: 409 };
    default:
      return { code: "operation_failed", status: 500 };
  }
}
