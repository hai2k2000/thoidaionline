import { parseTaskListSearchParams, taskListHref } from "./taskFilters.mjs";
import { classifyTaskDeadline } from "./deadlineClassification.mjs";
import { formatDateOnlyVN } from "./businessDate.mjs";
import { resolveDisplayedAssigner } from "./taskAssignmentDisplay.mjs";

/** @typedef {{ id: string, title: string, assignees: string, role: string, assigner: string, due: string, statusNote: string }} ReportRow */
/** @typedef {{ key: "work_done", title: string, rows: ReportRow[] }} ReportSection */
/** @typedef {{ content: string, assignee: string, dueDate: string }} NextWeekPlanItem */
/** @typedef {{ from: string, to: string, items: NextWeekPlanItem[] }} NextWeekPlan */
/** @typedef {NextWeekPlan & { title: string, periodLabel: string, headers: string[], rows: string[][], emptyText: string }} NextWeekPlanModel */
/** @typedef {{ title: string, lines: string[] }} ReportGeneralInfo */
/** @typedef {{ from: string, to: string, userName: string, jobTitle: string, generalInfo: ReportGeneralInfo, filterLabel: string, sections: ReportSection[], counts: { total: number }, nextWeekPlan: NextWeekPlanModel }} TaskListReportModel */

export const reportDate = (value) => value ? formatDateOnlyVN(value.slice(0, 10)) : "—";
export const reportSummary = (counts) => "Tổng: " + counts.total + " công việc";
const leaveTypeLabels = { annual: "phép năm", sick: "nghỉ ốm", unpaid: "nghỉ không lương", personal: "việc riêng", business: "công tác" };
const periodLabels = { morning: "buổi sáng", afternoon: "buổi chiều" };
const shortReportDate = value => { const [year, month, day] = value.slice(0, 10).split("-"); return `${Number(day)}/${Number(month)}/${year}`; };
export function formatReportLeaveText(leaves, from, to) {
  const entries = (leaves ?? []).filter(leave => leave?.status === undefined || leave.status === "approved").map(leave => {
    const start = leave.start_date > from ? leave.start_date : from;
    const end = leave.end_date < to ? leave.end_date : to;
    if (!validDate(leave.start_date) || !validDate(leave.end_date) || start > end) return null;
    const details = [];
    const startPeriod = start === leave.start_date ? periodLabels[leave.start_period] : undefined;
    const endPeriod = end === leave.end_date ? periodLabels[leave.end_period] : undefined;
    if (start === end) {
      if (leave.start_date !== leave.end_date) {
        if (startPeriod || endPeriod) details.push(startPeriod || endPeriod);
      } else if (startPeriod && startPeriod === endPeriod) details.push(startPeriod);
    } else {
      if (startPeriod) details.push(shortReportDate(start) + " " + startPeriod);
      if (endPeriod) details.push(shortReportDate(end) + " " + endPeriod);
    }
    const type = leaveTypeLabels[leave.leave_type];
    if (type) details.push(type);
    return shortReportDate(start) + (start === end ? "" : " - " + shortReportDate(end)) + (details.length ? " (" + details.join(", ") + ")" : "");
  }).filter(Boolean);
  return entries.join("; ") || "………………………………………………";
}
export function taskListReportDocxFilename(from, to, userName) { const formatDate = value => { const [year, month, day] = value.split("-"); return `${day}.${month}.${year}`; }; const safeName = userName.replace(/[\\/:*?"<>|\u0000-\u001F\u007F]/g, "").trim(); return `Báo cáo công việc tuần ${formatDate(from)}-${formatDate(to)}${safeName ? ` - ${safeName}` : ""}.docx`; }

/** @param {unknown} value @returns {string[] | null} */
export function parseReportIds(value) {
  const ids = typeof value === "string" ? (value ? value.split(",") : []) : value;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!Array.isArray(ids) || ids.length > 1000 || ids.some(id => typeof id !== "string" || !uuid.test(id))) return null;
  return [...new Set(ids.map(id => id.toLowerCase()))];
}

/** @param {ReportSection[]} sections */
export function countReportSections(sections) {
  const all = sections.flatMap(section => section.rows);
  return { total: all.length };
}

/** @param {TaskListReportModel} model @param {string[]} ids @returns {TaskListReportModel} */
export function selectTaskListReportModel(model, ids) {
  const selected = new Set(ids);
  const sections = model.sections.map(section => ({ ...section, rows: section.rows.filter(row => selected.has(row.id)) }));
  return { ...model, sections, counts: countReportSections(sections) };
}

/** @param {{ tasks: (Partial<import('./taskContracts').TaskListItemDto> & { title: string, status: string })[], from: string, to: string, userName: string, filterLabel: string, jobTitle?: string, leaveText?: string, actorId?: string, now?: Date }} input @returns {TaskListReportModel} */
export function buildTaskListReportModel(input) {
  const now = input.now ?? new Date();
  const statusLabels = { done: "Đã hoàn thành", new: "Mới", in_progress: "Đang thực hiện", waiting: "Chờ duyệt giao việc", pending_review: "Chờ duyệt hoàn thành", blocked: "Vướng mắc", rejected: "Trả lại" };
  const rows = [];
  for (const task of [...input.tasks].sort((a, b) => (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31") || a.title.localeCompare(b.title, "vi"))) {
    if (task.status === "cancelled") continue;
    const actorAssignments = input.actorId ? (task.task_assignees ?? []).filter(person => person.user_id === input.actorId && ["owner", "assignee"].includes(person.assignment_role)) : [];
    if (input.actorId && !actorAssignments.length) continue;
    const overdue = task.status !== "done" && classifyTaskDeadline({ ...task, due_date: task.due_date ?? null }, now) === "overdue";
    const completion = task.completed_at && Number.isFinite(Date.parse(task.completed_at)) ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(task.completed_at)) : "";
    const quickReport = task.workflow_type === "REPORT_ONLY" || task.task_type === "report_only";
    const progress = task.latest_progress_report ?? [...(task.task_progress_reports ?? [])].sort((a, b) => `${b.reported_on ?? ""}T${b.created_at ?? ""}`.localeCompare(`${a.reported_on ?? ""}T${a.created_at ?? ""}`))[0];
    const updateText = progress?.progress_text?.trim() || progress?.blockers?.trim() || "";
    const status = statusLabels[task.status] ?? task.status;
    const note = progress ? updateText : quickReport ? (task.report_notes?.trim() || "") : "";
    const statusNote = progress
      ? task.status === "done"
        ? status + (completion ? " " + completion : "") + (updateText ? " · " + updateText : "")
        : status + (updateText ? " · " + updateText : "") + (overdue ? " · Quá hạn" : "")
      : quickReport
        ? (note || status)
        : task.status === "done"
          ? (completion ? status + " " + completion : status)
          : status + (overdue ? " · Quá hạn" : "");
    rows.push({
      id: task.id, title: task.title + (task.project?.name ? " [" + task.project.name + "]" : ""), role: actorAssignments.some(person => person.assignment_role === "owner") ? "Người thực hiện" : "Người phối hợp",
      assignees: [...new Set((task.task_assignees ?? []).filter(person => ["owner", "assignee"].includes(person.assignment_role)).map(person => person.staff_users?.full_name).filter(Boolean))].join(", ") || "Chưa phân công",
      assigner: resolveDisplayedAssigner(task).value,
      due: reportDate(task.due_date) + (task.due_date && task.due_time ? " " + task.due_time.slice(0, 5) : ""),
      statusNote,
    });
  }
  const jobTitle = input.jobTitle?.trim() || "Nhân viên";
  const generalInfo = { title: "I. Thông tin chung và thời gian làm việc/vắng mặt", lines: [
    "Họ và tên: " + input.userName,
    "Chức danh: " + jobTitle,
    "Thời gian thực hiện báo cáo: Từ ngày " + shortReportDate(input.from) + " đến ngày " + shortReportDate(input.to),
    "Thời gian đi công tác/tác nghiệp bên ngoài: Theo phân công (nếu có)",
    "Thời gian xin nghỉ phép: " + (input.leaveText || "………………………………………………"),
  ] };
  /** @type {ReportSection[]} */
  const sections = [{ key: "work_done", title: "II. Công việc đã làm", rows }];
  return { from: input.from, to: input.to, userName: input.userName, jobTitle, generalInfo, filterLabel: input.filterLabel, sections, counts: countReportSections(sections), nextWeekPlan: buildNextWeekPlanModel(undefined, input.to) };
}

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

export function nextWeekAfterReportDate(to) {
  if (!validDate(to)) return null;
  const start = new Date(to + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  start.setUTCDate(start.getUTCDate() + 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.valueOf()) && parsed.getUTCFullYear() >= 1 && parsed.toISOString().slice(0, 10) === value;
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
  if (task.status === "cancelled") return false;
  const due = task.due_date;
  const completed = task.completed_at && Number.isFinite(Date.parse(task.completed_at))
    ? vietnamDate(new Date(task.completed_at)) : null;
  const start = task.start_date;
  return Boolean((due && due >= from && due <= to)
    || (completed && completed >= from && completed <= to)
    || (task.status !== "done" && start && start <= to));
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
  const fields = { departmentId: "Phòng", personId: "Người làm", taskType: "Loại", status: "Trạng thái", statusGroup: "Nhóm trạng thái", projectId: "Dự án", search: "Từ khóa", deadlineState: "Hạn", fromDate: "Bắt đầu từ", toDate: "Hạn đến", assignmentSource: "Nguồn giao", category: "Danh mục", journalism: "Nghiệp vụ", journalismWorkKindId: "Loại nghiệp vụ", publicationStatus: "Xuất bản", plannedPublicationFrom: "Xuất bản từ", plannedPublicationTo: "Xuất bản đến", topicId: "Chủ đề", seriesId: "Loạt bài" };
  return Object.entries(fields).filter(([key]) => query[key]).map(([key, title]) =>
    title + ": " + (name(key, query[key]) || labels[query[key]] || query[key])).join("; ");
}

/** @param {unknown} value @param {string} expectedTo @returns {{ ok: true, plan: NextWeekPlan } | { ok: false, message: string }} */
export function validateNextWeekPlan(value, expectedTo) {
  if (value === undefined) {
    const period = nextWeekAfterReportDate(expectedTo);
    return period && validDate(period.from) && validDate(period.to)
      ? { ok: true, plan: { ...period, items: [] } }
      : { ok: false, message: "Khoảng thời gian kế hoạch tuần sau không hợp lệ." };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, message: "Kế hoạch tuần sau không hợp lệ." };
  if (!validDate(value.from) || !validDate(value.to) || value.from > value.to) return { ok: false, message: "Khoảng thời gian kế hoạch tuần sau không hợp lệ." };
  if (!Array.isArray(value.items) || value.items.length > 100) return { ok: false, message: "Kế hoạch tuần sau có tối đa 100 dòng." };
  const items = [];
  for (const item of value.items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, message: "Dòng kế hoạch tuần sau không hợp lệ." };
    if (typeof item.content !== "string" || item.content.length > 1000) return { ok: false, message: "Nội dung công việc phải là văn bản, tối đa 1.000 ký tự." };
    if (item.assignee !== undefined && (typeof item.assignee !== "string" || item.assignee.length > 200)) return { ok: false, message: "Người thực hiện phải là văn bản, tối đa 200 ký tự." };
    if (item.dueDate !== undefined && item.dueDate !== "" && !validDate(item.dueDate)) return { ok: false, message: "Thời hạn kế hoạch phải là ngày hợp lệ." };
    const content = item.content.trim(), assignee = (item.assignee ?? "").trim(), dueDate = item.dueDate ?? "";
    if (!content && !assignee && !dueDate) continue;
    if (!content) return { ok: false, message: "Vui lòng nhập nội dung công việc cho dòng kế hoạch." };
    // XML 1.0 cannot represent these control characters in DOCX text nodes.
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(content + assignee)) return { ok: false, message: "Nội dung kế hoạch chứa ký tự không hợp lệ." };
    items.push({ content, assignee, dueDate });
  }
  return { ok: true, plan: { from: value.from, to: value.to, items } };
}

/** @param {unknown} value @param {string} reportTo @returns {NextWeekPlanModel} */
export function buildNextWeekPlanModel(value, reportTo) {
  const result = validateNextWeekPlan(value, reportTo);
  if (!result.ok) throw new Error(result.message);
  const plan = result.plan;
  return { ...plan, title: "III. Kế hoạch tuần sau", periodLabel: "(Từ ngày " + reportDate(plan.from) + " đến ngày " + reportDate(plan.to) + ")",
    headers: ["STT", "Nội dung công việc", "Người thực hiện", "Thời hạn"], emptyText: "………",
    rows: plan.items.map((item, index) => [String(index + 1), item.content, item.assignee, item.dueDate ? reportDate(item.dueDate) : ""]),
  };
}

/** @param {TaskListReportModel} model @param {unknown} plan @returns {TaskListReportModel} */
export function planFromReportModel(model, plan) {
  return { ...model, nextWeekPlan: buildNextWeekPlanModel(plan, model.to) };
}

/** @param {NextWeekPlanItem[]} items @param {TaskListReportModel} model @returns {NextWeekPlanItem[]} */
export function appendNextWeekPlanTasks(items, model) {
  const key = item => JSON.stringify([item.content.trim(), item.assignee.trim(), item.dueDate]);
  const result = [...items];
  const seen = new Set(items.map(key));
  for (const row of model.sections.flatMap(section => section.rows)) {
    if (row.statusNote.startsWith("Đã hoàn thành")) continue;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(row.due);
    const item = { content: row.title, assignee: row.assignees === "Chưa phân công" ? "" : row.assignees, dueDate: match ? `${match[3]}-${match[2]}-${match[1]}` : "" };
    if (!seen.has(key(item)) && result.length < 100) { result.push(item); seen.add(key(item)); }
  }
  return result;
}
