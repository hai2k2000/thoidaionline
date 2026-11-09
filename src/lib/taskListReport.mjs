import { parseTaskListSearchParams, taskListHref } from "./taskFilters.mjs";

const vietnamDate = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(value);

export function currentReportWeek(now = new Date()) {
  const start = new Date(vietnamDate(now) + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

export function parseReportRequest(params) {
  const from = params.get("from"), to = params.get("to");
  if (!validDate(from) || !validDate(to) || from > to) return null;
  // Report dates and the list's start/due filters have different semantics.
  const list = new URLSearchParams(params);
  for (const key of ["from", "to"]) {
    list.delete(key);
    if (params.get("list" + key)) list.set(key, params.get("list" + key));
  }
  const query = parseTaskListSearchParams(list, { defaultJournalism: "exclude" });
  if (query.fromDate && query.toDate && query.fromDate > query.toDate) return null;
  return { from, to, query: { ...query, page: 1, pageSize: 100 } };
}

export function taskListReportHref(query, range) {
  const params = new URLSearchParams(taskListHref(query, { page: 1 }).split("?")[1]);
  for (const key of ["from", "to"]) {
    if (params.get(key)) params.set("list" + key, params.get(key));
    params.set(key, range[key]);
  }
  return "/api/tasks/report/docx?" + params.toString();
}

export function isTaskActiveInReportRange(task, from, to) {
  const due = task.due_date;
  const completed = task.completed_at && Number.isFinite(Date.parse(task.completed_at))
    ? vietnamDate(new Date(task.completed_at)) : null;
  const start = task.start_date;
  return Boolean((due && due >= from && due <= to)
    || (completed && completed >= from && completed <= to)
    || (!["done", "cancelled"].includes(task.status) && start && start <= to));
}

/** @template T @param {T[]} tasks @param {string} from @param {string} to @returns {T[]} */
export function selectTasksForReport(tasks, from, to) {
  return tasks.filter((task) => isTaskActiveInReportRange(task, from, to));
}

const labels = {
  all: "Tất cả", assigned: "Được giao", collaborating: "Phối hợp", department_collaborating: "Phối hợp của phòng",
  personal: "Cá nhân", mine: "Việc của tôi", watching: "Tôi theo dõi", cancelled: "Đã hủy",
  new: "Mới", in_progress: "Đang thực hiện", blocked: "Vướng mắc", waiting: "Chờ duyệt giao việc",
  pending_review: "Chờ duyệt hoàn thành", done: "Đã hoàn thành", rejected: "Trả lại",
  completed: "Đã hoàn thành", unfinished: "Chưa hoàn thành", returned: "Trả lại",
  on_time: "Còn hạn", due_soon: "Sắp đến hạn", overdue: "Quá hạn", no_deadline: "Chưa có hạn",
  leadership_assigned: "Lãnh đạo giao", self_registered: "Tự đăng ký", legacy_unknown: "Dữ liệu cũ",
  only: "Nghiệp vụ báo chí", exclude: "Công việc thường", duty: "Lịch trực",
  not_published: "Chưa xuất bản", scheduled: "Đã lên lịch", published: "Đã xuất bản", withdrawn: "Đã gỡ",
  assignment: "Duyệt giao việc", completion: "Duyệt hoàn thành",
};

/** @param {import("./taskContracts").TaskListQuery} query @param {import("./taskContracts").TaskListItemDto[]} rows */
export function reportFilterLabel(query, rows = []) {
  const name = (key, id) => {
    if (key === "departmentId") return rows.find(row => row.department_id === id)?.departments?.name;
    if (key === "projectId") return id === "none" ? "Không thuộc dự án" : rows.find(row => row.project_id === id)?.project?.name;
    if (key === "personId") return rows.flatMap(row => row.task_assignees ?? []).find(person => person.user_id === id)?.staff_users?.full_name;
    return null;
  };
  const fields = { scope: "Phạm vi", departmentId: "Phòng", personId: "Người làm", taskType: "Loại", status: "Trạng thái", statusGroup: "Nhóm trạng thái", projectId: "Dự án", search: "Từ khóa", deadlineState: "Hạn", fromDate: "Bắt đầu từ", toDate: "Hạn đến", assignmentSource: "Nguồn giao", category: "Danh mục", journalism: "Nghiệp vụ", journalismWorkKindId: "Loại nghiệp vụ", publicationStatus: "Xuất bản", plannedPublicationFrom: "Xuất bản từ", plannedPublicationTo: "Xuất bản đến", topicId: "Chủ đề", seriesId: "Loạt bài" };
  return Object.entries(fields).filter(([key]) => query[key]).map(([key, title]) =>
    title + ": " + (name(key, query[key]) || labels[query[key]] || query[key])).join("; ") || "Tất cả";
}
