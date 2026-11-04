import { searchText } from "./projectTaskFilters.mjs";

export const DEFAULT_PROJECT_LIST_FILTERS = Object.freeze({ q: "", status: "", role: "", dept: "", lead: "", tasks: "", sort: "updated_desc" });
export function normalizeProjectListFilters(filters = {}) {
  return { ...DEFAULT_PROJECT_LIST_FILTERS, ...filters };
}
export function filterAndSortProjects(projects, filters = {}) {
  const f = normalizeProjectListFilters(filters);
  const query = searchText(f.q);
  return projects.filter(({ project, myRole, leadPeople, taskCounts }) =>
    (!query || searchText(`${project.code} ${project.name}`).includes(query)) &&
    (!f.status || project.status === f.status) &&
    (!f.role || (f.role === "none" ? myRole === null : myRole === f.role)) &&
    (!f.dept || project.host_department_id === f.dept) &&
    (!f.lead || leadPeople.some(person => person.id === f.lead)) &&
    (!f.tasks || (taskCounts?.[f.tasks] ?? 0) > 0)
  ).sort((a, b) => {
    if (f.sort === "name_asc") return a.project.name.localeCompare(b.project.name, "vi");
    if (f.sort === "code_asc") return a.project.code.localeCompare(b.project.code, "vi", { numeric: true });
    if (f.sort === "in_progress_desc") {
      const count = (b.taskCounts?.in_progress ?? 0) - (a.taskCounts?.in_progress ?? 0);
      if (count) return count;
    }
    return (Date.parse(b.project.updated_at) || 0) - (Date.parse(a.project.updated_at) || 0);
  });
}
