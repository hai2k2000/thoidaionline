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
  priority: string;
  created_at: string;
  status: CanonicalTaskStatus;
  task_type: CanonicalTaskType | null;
  compatibility_task_type: CanonicalTaskType | null;
  legacy_read_only: boolean;
  start_date: string | null;
  completion_submitted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  progress_percent: number;
  due_date: string | null;
  due_time: string | null;
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

export type TaskProgressReportDto = { id: string; reported_by: string; reported_on: string; report_status: string; progress_text: string; blockers: string | null; created_at: string; };
export type TaskQualitativeEvaluationSource = "chatgpt" | "leader";
export type TaskQualitativeEvaluationDto = { id: string; evaluation_text: string; evaluation_deadline: string; evaluation_source: TaskQualitativeEvaluationSource; created_at: string; evaluator: { full_name: string | null } | null; };
export type TaskDeadlineHistoryDto = { id: string; old_due_date: string | null; new_due_date: string | null; reason: string; changed_at: string; };
export type TaskStatusEventDto = { id: string; from_status: string | null; to_status: string; reason: string | null; created_at: string; };
export type TaskAttachmentDto = { id: string; file_name: string; mime_type: string; size_bytes: number; created_at: string; uploaded_by: string; };

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
  progress_reports: TaskProgressReportDto[];
  qualitative_evaluations: TaskQualitativeEvaluationDto[];
  deadline_history: TaskDeadlineHistoryDto[];
  status_events: TaskStatusEventDto[];
  attachments: TaskAttachmentDto[];
};

export type TaskListQuery = {
  search: string | null;
  scope: "all" | "assigned" | "personal" | "watching";
  taskType: CanonicalTaskType | null;
  status: CanonicalTaskStatus | null;
  statusGroup: "completed" | "unfinished" | "returned" | null;
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

export type AssignedTaskInput = {
  title: string;
  description: string;
  departmentId: string;
  assigneeId: string;
  reviewerId: string;
  dueDate: string;
  dueTime: string;
  evaluationCriteria: string | null;
  collaboratorIds: string[];
  watcherIds: string[];
  recurrenceFrequency: "daily" | "weekly" | "monthly" | null;
  recurrenceEndsOn: string | null;
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

export type QualitativeEvaluationInput = {
  evaluationText: string;
  evaluationDeadline: string | null;
  evaluationSource: TaskQualitativeEvaluationSource;
};

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
  assign(
    actorId: string,
    input: AssignedTaskInput,
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
  submitStructuredProgress(actorId: string, taskId: string, input: { reportedOn: string; reportStatus: string; progressText: string; blockers: string | null }): Promise<RepositoryResult<unknown>>;
  submitQualitativeEvaluation(actorId: string, taskId: string, input: QualitativeEvaluationInput): Promise<RepositoryResult<TaskQualitativeEvaluationDto>>;
  submitAssignedCompletion(actorId: string, taskId: string): Promise<RepositoryResult<unknown>>;
  reviewAssignedCompletion(actorId: string, taskId: string, decision: "approve" | "return", reason: string | null): Promise<RepositoryResult<unknown>>;
  cancelAssigned(actorId: string, taskId: string, reason: string): Promise<RepositoryResult<unknown>>;
  changeAssignedDeadline(actorId: string, taskId: string, dueDate: string, reason: string): Promise<RepositoryResult<unknown>>;
  addAttachmentMetadata(actorId: string, taskId: string, input: { storagePath: string; fileName: string; mimeType: string; sizeBytes: number }): Promise<RepositoryResult<TaskAttachmentDto>>;
  attachment(taskId: string, attachmentId: string): Promise<RepositoryResult<(TaskAttachmentDto & { storage_path: string }) | null>>;
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
