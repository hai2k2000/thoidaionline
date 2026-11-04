export type ProjectListFilters = { q: string; status: string; role: string; dept: string; lead: string; tasks: string; sort: string };
type FilterableProject = {
  project: { name: string; code: string; status: string; host_department_id: string; updated_at: string };
  myRole: string | null;
  leadPeople: { id: string; name: string }[];
  taskCounts: Record<string, number> | null;
};
export const DEFAULT_PROJECT_LIST_FILTERS: Readonly<ProjectListFilters>;
export function normalizeProjectListFilters(filters?: Partial<ProjectListFilters>): ProjectListFilters;
export function filterAndSortProjects<T extends FilterableProject>(projects: readonly T[], filters?: Partial<ProjectListFilters>): T[];
