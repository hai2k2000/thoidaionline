import type { AuthorizationActor, TaskAccessSnapshot } from "./authorization";
import type { CanonicalTaskStatus, CanonicalTaskType } from "./taskCompatibility";

export type AssignmentRole = "owner" | "assignee" | "watcher";

export type TaskParticipantDto = {
  user_id: string;
  assignment_role: AssignmentRole;
  status: string;
  staff_users: { full_name: string | null } | null;
};

export type TaskListItemDto = {
  id: string;
  title: string;
  created_at: string;
  status: CanonicalTaskStatus;
  task_type: CanonicalTaskType | null;
  compatibility_task_type: CanonicalTaskType | null;
  legacy_read_only: boolean;
  start_date: string | null;
  progress_percent: number;
  due_date: string | null;
  assignee_id: string | null;
  owner_id: string | null;
  created_by: string | null;
  reviewer_id: string | null;
  department_id: string | null;
  assignment_mode: string;
  plan_period: "ad_hoc" | "daily" | "weekly" | "monthly";
  self_claimable: boolean;
  departments: { name: string } | null;
  task_assignees: TaskParticipantDto[];
};

export type TaskCommentDto = {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  staff_users: { full_name: string | null } | null;
};

export type TaskProgressLogDto = {
  id: string;
  old_progress: number | null;
  new_progress: number;
  note: string | null;
  created_at: string;
  user_id: string | null;
  staff_users: { full_name: string | null } | null;
};

export type LegacyEvaluationDto = {
  id: string;
  task_id: string;
  employee_id: string;
  reviewer_id: string | null;
  rating: number;
  effort_weight: number;
  total_score: number | null;
  completion: string;
  on_time: boolean;
  opinion: string | null;
  checkpoint_date: string;
  is_final: boolean;
  created_at: string;
};

export type TaskDetailDto = TaskListItemDto & {
  description: string | null;
  attachment_url: string | null;
  effort_weight: number | null;
  evaluation_criteria: string | null;
  owner: { full_name: string | null } | null;
  reviewer: { full_name: string | null } | null;
  comments: TaskCommentDto[];
  progress_logs: TaskProgressLogDto[];
  legacy_evaluations: LegacyEvaluationDto[];
};

export type TaskListQuery = {
  search: string | null;
  scope: "all" | "assigned" | "personal" | "watching";
  taskType: CanonicalTaskType | null;
  status: CanonicalTaskStatus | null;
  fromDate: string | null;
  toDate: string | null;
  deadlineState: "on_time" | "due_soon" | "overdue" | "no_deadline" | null;
  departmentId: string | null;
  page: number;
  pageSize: number;
};

export type TaskListResult = {
  items: TaskListItemDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type LegacyCreateTaskInput = {
  title: string;
  description: string;
  departmentId: string | null;
  assigneeId: string;
  reviewerId: string;
  assignmentMode: "individual" | "multi_user" | "department" | "mixed";
  dueDate: string;
  collaboratorIds: string[];
};

export type LegacyUpdateTaskInput = {
  status?: "new" | "in_progress";
  dueDate?: string | null;
};

export type LegacyEvaluationInput = {
  employeeId: string;
  rating: number;
  effortWeight: number;
  completion: "not_done" | "done" | "excellent";
  onTime: boolean;
  opinion: string | null;
  checkpointDate: string;
  isFinal: boolean;
};

export type PersonalTaskInput = {
  title: string;
  description: string;
  startDate: string;
  dueDate: string;
  evaluationCriteria: string | null;
};

export type PersonalTaskEditInput = Omit<PersonalTaskInput, "dueDate">;

export type RepositoryError = { code?: string | null };
export type RepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RepositoryError };

export interface TaskRepository {
  list(
    actor: AuthorizationActor,
    query: TaskListQuery,
  ): Promise<RepositoryResult<TaskListResult>>;
  access(taskId: string): Promise<RepositoryResult<TaskAccessSnapshot | null>>;
  detail(taskId: string): Promise<RepositoryResult<TaskDetailDto | null>>;
  create(
    actorId: string,
    input: LegacyCreateTaskInput,
  ): Promise<RepositoryResult<{ id: string }>>;
  createPersonal(
    actorId: string,
    input: PersonalTaskInput,
  ): Promise<RepositoryResult<{ id: string }>>;
  editPersonal(
    actorId: string, taskId: string, input: PersonalTaskEditInput,
  ): Promise<RepositoryResult<{ id: string }>>;
  changePersonalDeadline(
    actorId: string, taskId: string, dueDate: string, reason: string,
  ): Promise<RepositoryResult<{ id: string }>>;
  cancelPersonal(
    actorId: string, taskId: string, reason: string,
  ): Promise<RepositoryResult<{ id: string }>>;
  completePersonal(
    actorId: string, taskId: string,
  ): Promise<RepositoryResult<{ id: string }>>;
  update(
    actorId: string,
    taskId: string,
    input: LegacyUpdateTaskInput,
  ): Promise<RepositoryResult<{ id: string }>>;
  claim(actorId: string, taskId: string): Promise<RepositoryResult<unknown>>;
  report(
    actorId: string,
    taskId: string,
    progress: number,
    report: string,
    blockers: string | null,
  ): Promise<RepositoryResult<unknown>>;
  review(
    actorId: string,
    taskId: string,
    decision: "approve" | "reject",
    note: string | null,
  ): Promise<RepositoryResult<unknown>>;
  evaluate(
    actorId: string,
    taskId: string,
    input: LegacyEvaluationInput,
  ): Promise<RepositoryResult<unknown>>;
  comment(
    actorId: string,
    taskId: string,
    content: string,
  ): Promise<RepositoryResult<unknown>>;
  bulkPlan(
    actorId: string,
    input: {
      planPeriod: "daily" | "weekly";
      dueDate: string;
      reviewerId: string;
      description: string;
      items: { title: string }[];
      batchId: string;
    },
  ): Promise<RepositoryResult<unknown>>;
}
