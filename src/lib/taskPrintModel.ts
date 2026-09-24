import type { TaskDetailDto } from "./taskContracts";

export type WorkAssignmentPrintModel = {
  id: string;
  assignedDate: string;
  taskType: string;
  department: string;
  assigner: string;
  primaryAssignee: string;
  collaborators: string[];
  title: string;
  description: string;
  requirements: string[];
  deadline: string;
  priority: string;
  notes: string;
  journalism: {
    topics: string[];
    series: string;
    plannedPublicationDate: string;
    publicationStatus: string;
  } | null;
};

const taskTypeLabel = (task: TaskDetailDto) => {
  if (task.journalism) return "Công việc nghiệp vụ báo chí";
  return task.compatibility_task_type === "personal" || task.task_type === "personal"
    ? "Nhiệm vụ cá nhân"
    : "Công việc thường";
};

const priorityLabels: Record<string, string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn cấp",
};

const publicationStatusLabels: Record<string, string> = {
  not_published: "Chưa xuất bản",
  scheduled: "Đã lên lịch",
  published: "Đã xuất bản",
  withdrawn: "Đã gỡ",
};

const parseRequirements = (value: string | null) => {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
};

const participantName = (row: TaskDetailDto["task_assignees"][number] | null | undefined) => row?.staff_users?.full_name?.trim() || null;

export function buildWorkAssignmentPrintModel(task: TaskDetailDto): WorkAssignmentPrintModel {
  const primaryId = task.assignee_id
    ?? task.task_assignees.find((row) => row.assignment_role === "owner")?.user_id
    ?? null;
  const primary = task.task_assignees.find((row) => row.user_id === primaryId)
    ?? task.task_assignees.find((row) => row.assignment_role === "owner");
  const collaborators = task.task_assignees
    .filter((row) => row.assignment_role === "assignee" && row.user_id !== primaryId)
    .map(participantName)
    .filter((name): name is string => Boolean(name));
  const journalism = task.journalism ? {
    topics: task.journalism.topics.map((topic) => topic.name),
    series: task.journalism.series?.name ?? "—",
    plannedPublicationDate: task.journalism.planned_publication_at ?? "—",
    publicationStatus: publicationStatusLabels[task.journalism.publication_status] ?? task.journalism.publication_status,
  } : null;

  return {
    id: task.id,
    assignedDate: task.created_at,
    taskType: taskTypeLabel(task),
    department: task.departments?.name ?? "—",
    assigner: task.created_by_user?.full_name ?? "—",
    primaryAssignee: participantName(primary) ?? task.owner?.full_name ?? "—",
    collaborators,
    title: task.title,
    description: task.description ?? "—",
    requirements: parseRequirements(task.evaluation_criteria),
    deadline: task.due_date ? `${task.due_date}${task.due_time ? ` ${task.due_time.slice(0, 5)}` : ""}` : "—",
    priority: priorityLabels[task.priority] ?? task.priority ?? "—",
    notes: task.journalism?.editorial_notes?.trim() || "—",
    journalism,
  };
}
