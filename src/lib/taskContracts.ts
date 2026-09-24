import type { AuthorizationActor, TaskAccessSnapshot } from "./authorization";
import type { CanonicalTaskStatus, CanonicalTaskType } from "./taskCompatibility";

export type AssignmentRole = "owner" | "assignee" | "watcher";

export type JournalismPublicationStatus =
  | "not_published"
  | "scheduled"
  | "published"
  | "withdrawn";

export type JournalismWorkKindDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export type JournalismTopicDto = {
  id: string;
  name: string;
  isActive: boolean;
  departmentId: string | null;
  description?: string | null;
};

export type JournalismSeriesDto = {
  id: string;
  name: string;
  isActive: boolean;
  departmentId: string | null;
  topicId: string | null;
  position: number;
  description?: string | null;
};

export type JournalismPublicationVerificationDecision = "verified" | "rejected";
export type JournalismPublicationVerificationStatus = "unverified" | "verified" | "rejected" | "stale";

export type JournalismPublicationVerificationDto = {
  id: string;
  publication_report_id: string;
  decision: JournalismPublicationVerificationDecision;
  note: string | null;
  verified_by: string;
  publication_report_updated_at: string;
  created_at: string;
  verifier: { full_name: string | null } | null;
  isCurrent: boolean;
};

export type JournalismPublicationReportDto = {
  id: string;
  task_id: string;
  publication_url: string;
  published_title: string | null;
  published_at: string;
  note: string | null;
  reported_by: string;
  created_at: string;
  updated_at: string;
  reporter: { full_name: string | null } | null;
  verification_status: JournalismPublicationVerificationStatus;
  current_verification: JournalismPublicationVerificationDto | null;
  verification_history: JournalismPublicationVerificationDto[];
};

export type JournalismTaskListSummaryDto = {
  publication_status: JournalismPublicationStatus;
  planned_publication_at: string | null;
  published_at: string | null;
  work_kind: Pick<JournalismWorkKindDto, "id" | "code" | "name" | "is_active">;
  topicCount: number;
  series: JournalismSeriesDto | null;
};

export type JournalismTaskDetailDto = JournalismTaskListSummaryDto & {
  task_id: string;
  location: string | null;
  article_url: string | null;
  editorial_notes: string | null;
  created_at: string;
  updated_at: string;
  work_kind: JournalismWorkKindDto;
  topics: JournalismTopicDto[];
  publication_report: JournalismPublicationReportDto | null;
};

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
  approval_required: boolean;
  task_type: CanonicalTaskType | null;
  task_category: "regular" | "duty";
  duty_month: string | null;
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
  created_by_user: { full_name: string | null } | null;
  description: string | null;
  evaluation_criteria: string | null;
  completion_score: { requirement_score: number; collaboration_score: number; initiative_score: number; total_score: number; note: string | null } | null;
  journalism: JournalismTaskListSummaryDto | null;
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
export type TaskCompletionScoreDto = { id: string; requirement_results: Array<{ index: number; achieved: boolean }>; requirement_score: number; collaboration_score: number; initiative_score: number; total_score: number; note: string | null; created_at: string; reviewer: { full_name: string | null } | null; };

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
  completion_score: TaskCompletionScoreDto | null;
  journalism: JournalismTaskDetailDto | null;
};

export type TaskListQuery = {
  search: string | null;
  scope: "all" | "assigned" | "personal" | "watching" | "cancelled";
  taskType: CanonicalTaskType | null;
  category?: "duty" | null;
  status: CanonicalTaskStatus | null;
  statusGroup: "completed" | "unfinished" | "returned" | "cancelled" | null;
  fromDate: string | null;
  toDate: string | null;
  deadlineState: "on_time" | "due_soon" | "overdue" | "no_deadline" | null;
  departmentId: string | null;
  journalism?: "only" | "exclude" | null;
  approvalQueue?: "assignment" | "completion" | null;
  journalismWorkKindId?: string | null;
  publicationStatus?: JournalismPublicationStatus | null;
  plannedPublicationFrom?: string | null;
  plannedPublicationTo?: string | null;
  topicId?: string | null;
  seriesId?: string | null;
  page: number;
  pageSize: number;
};

export type TaskListResult = {
  items: TaskListItemDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type TaskApprovalQueueItem = TaskListItemDto & {
  last_reason: string | null;
  last_event_at: string | null;
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
  requirements: string[];
  departmentId: string;
  assigneeId: string;
  reviewerId: string;
  dueDate: string;
  dueTime: string;
  evaluationCriteria: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  collaboratorIds: string[];
  watcherIds: string[];
  recurrenceFrequency: "daily" | "weekly" | "monthly" | null;
  recurrenceEndsOn: string | null;
};

export type JournalismCreateInput = AssignedTaskInput & { workKindId: string; plannedPublicationAt: string | null; location: string | null; editorialNotes: string | null; };

export type LegacyUpdateTaskInput = {
  status?: "new" | "in_progress";
  dueDate?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
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
  recurrenceFrequency: "daily" | "weekly" | "monthly" | null;
  recurrenceEndsOn: string | null;
};

export type PersonalTaskEditInput = Omit<PersonalTaskInput, "dueDate" | "recurrenceFrequency" | "recurrenceEndsOn">;

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
  detail(taskId: string, actor?: AuthorizationActor): Promise<RepositoryResult<TaskDetailDto | null>>;
  listApprovalQueue(actor: AuthorizationActor, queue: "assignment" | "completion"): Promise<RepositoryResult<TaskListResult>>;
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
  adminEditTask(actorId: string, taskId: string, input: { title: string; description: string; startDate: string; dueDate: string; dueTime: string | null; priority: string; status: string; evaluationCriteria: string | null; reason: string }): Promise<RepositoryResult<unknown>>;
  submitStructuredProgress(actorId: string, taskId: string, input: { reportedOn: string; reportStatus: string; progressText: string; blockers: string | null }): Promise<RepositoryResult<unknown>>;
  submitQualitativeEvaluation(actorId: string, taskId: string, input: QualitativeEvaluationInput): Promise<RepositoryResult<TaskQualitativeEvaluationDto>>;
  submitAssignedCompletion(actorId: string, taskId: string): Promise<RepositoryResult<unknown>>;
  reviewAssignedCompletion(actorId: string, taskId: string, decision: "approve" | "return", reason: string | null): Promise<RepositoryResult<unknown>>;
  scoreTaskCompletion(actorId: string, taskId: string, requirementResults: unknown[], requirementScore: number, collaborationScore: number, initiativeScore: number, note: string | null): Promise<RepositoryResult<unknown>>;
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
