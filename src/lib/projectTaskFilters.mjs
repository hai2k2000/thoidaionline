import { classifyTaskDeadline } from "./deadlineClassification.mjs";

export const DEFAULT_PROJECT_TASK_FILTERS = Object.freeze({
  search: "", status: "", assignee: "", creator: "", reviewer: "", collaborator: "", priority: "", mine: false, deadlineState: "",
  dateFrom: "", dateTo: "", sort: "due_asc",
});

export function normalizeProjectTaskFilters(filters = {}) {
  return { ...DEFAULT_PROJECT_TASK_FILTERS, ...filters };
}

export const searchText = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim();

export function filterAndSortProjectTasks(tasks, filters = {}, now = new Date()) {
  const f = normalizeProjectTaskFilters(filters);
  const search = searchText(f.search);
  const visible = tasks.filter(task =>
    (f.status ? task.status === f.status : task.status !== "cancelled") &&
    (!search || searchText(task.title).includes(search)) &&
    (!f.assignee || task.assignee_id === f.assignee) &&
    (!f.creator || task.created_by === f.creator) &&
    (!f.reviewer || task.reviewer_id === f.reviewer) &&
    (!f.collaborator || (task.collaborator_ids ?? []).includes(f.collaborator)) &&
    (!f.priority || task.priority === f.priority) &&
    (!f.mine || (Boolean(f.currentUserId) && (task.assignee_id === f.currentUserId || task.reviewer_id === f.currentUserId || (task.collaborator_ids ?? []).includes(f.currentUserId)))) &&
    (!f.deadlineState || classifyTaskDeadline(task, now) === f.deadlineState) &&
    (!f.dateFrom || (task.due_date && task.due_date >= f.dateFrom)) &&
    (!f.dateTo || (task.due_date && task.due_date <= f.dateTo))
  );
  visible.sort((a, b) => {
    if (f.sort === "title_asc") return a.title.localeCompare(b.title, "vi");
    if (f.sort === "created_desc") return Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? "");
    if (!a.due_date) return b.due_date ? 1 : 0;
    if (!b.due_date) return -1;
    return (f.sort === "due_desc" ? -1 : 1) * a.due_date.localeCompare(b.due_date);
  });
  return {
    tasks: visible,
    hiddenCancelledCount: f.status ? 0 : tasks.filter(task => task.status === "cancelled").length,
  };
}
