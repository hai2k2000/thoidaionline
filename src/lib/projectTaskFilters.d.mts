import type { DeadlineTask, DeadlineState } from "./deadlinePresentation.mjs";

export type ProjectTaskFilters = {
  search: string;
  status: string;
  assignee: string;
  creator: string;
  reviewer: string;
  collaborator: string;
  priority: string;
  mine: boolean;
  currentUserId?: string;
  deadlineState: "" | Exclude<DeadlineState, "cancelled">;
  dateFrom: string;
  dateTo: string;
  sort: "due_asc" | "due_desc" | "created_desc" | "title_asc";
};
type FilterableTask = DeadlineTask & {
  title: string;
  assignee_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  reviewer_id?: string | null;
  collaborator_ids?: string[];
  priority?: string;
};
export const DEFAULT_PROJECT_TASK_FILTERS: Readonly<ProjectTaskFilters>;
export function searchText(value: unknown): string;
export function normalizeProjectTaskFilters(filters?: Partial<ProjectTaskFilters>): ProjectTaskFilters;
export function filterAndSortProjectTasks<T extends FilterableTask>(tasks: readonly T[], filters?: Partial<ProjectTaskFilters>, now?: Date): { tasks: T[]; hiddenCancelledCount: number };
