import TaskStatusTablePage from "@/components/TaskStatusTablePage";

export default function TasksPendingReviewPage() {
  return <TaskStatusTablePage title="Công việc chờ duyệt" currentPath="/tasks/pending-review" mode="pending_review" />;
}
