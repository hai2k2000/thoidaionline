import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";

export type NotificationKind = "assignment" | "deadline" | "comment" | "status" | "deadline_change";

export type NotificationItem = {
  key: string;
  kind: NotificationKind;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  unread: boolean;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  owner_id: string | null;
  assignee_id: string | null;
  reviewer_id: string | null;
};

const statusLabels: Record<string, string> = {
  new: "Mới",
  in_progress: "Đang làm",
  blocked: "Có vướng mắc",
  waiting: "Chờ duyệt nhận việc",
  pending_review: "Chờ chấm điểm",
  rejected: "Trả lại",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
};

const todayInVietnam = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

const dateDiff = (from: string, to: string) => Math.round(
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000,
);

const formatDate = (value: string) => new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short",
}).format(new Date(`${value}T12:00:00+07:00`));

const taskSelect = "id,title,status,due_date,created_at,updated_at,created_by,owner_id,assignee_id,reviewer_id";
const assignmentCutoff = () => new Date(Date.now() - 30 * 86400000).toISOString();

export const notificationRepository = {
  async list(userId: string): Promise<{ ok: true; items: NotificationItem[] } | { ok: false }> {
    const participantResult = await serverSupabase.from("task_assignees")
      .select("task_id,assignment_role,assigned_at")
      .eq("user_id", userId).order("assigned_at", { ascending: false }).limit(500);
    if (participantResult.error) return { ok: false };

    const participantRows = (participantResult.data ?? []) as Array<{
      task_id: string; assignment_role: string; assigned_at: string;
    }>;
    const participantIds = [...new Set(participantRows.map((row) => row.task_id))];
    const directPromise = serverSupabase.from("tasks").select(taskSelect)
      .or(`created_by.eq.${userId},owner_id.eq.${userId},assignee_id.eq.${userId},reviewer_id.eq.${userId}`)
      .order("updated_at", { ascending: false }).limit(500);
    const participantPromise = participantIds.length
      ? serverSupabase.from("tasks").select(taskSelect).in("id", participantIds).limit(500)
      : Promise.resolve({ data: [], error: null });
    const [directResult, participantTaskResult] = await Promise.all([directPromise, participantPromise]);
    if (directResult.error || participantTaskResult.error) return { ok: false };

    const taskMap = new Map<string, TaskRow>();
    for (const task of [...(directResult.data ?? []), ...(participantTaskResult.data ?? [])] as TaskRow[]) {
      taskMap.set(task.id, task);
    }
    const tasks = [...taskMap.values()];
    const taskIds = tasks.map((task) => task.id);
    if (!taskIds.length) return { ok: true, items: [] };

    const [comments, statuses, deadlines] = await Promise.all([
      serverSupabase.from("task_comments").select("id,task_id,user_id,content,created_at,staff_users(full_name)")
        .in("task_id", taskIds).or(`user_id.is.null,user_id.neq.${userId}`).order("created_at", { ascending: false }).limit(100),
      serverSupabase.from("task_status_events").select("id,task_id,actor_id,to_status,reason,created_at")
        .in("task_id", taskIds).neq("actor_id", userId).order("created_at", { ascending: false }).limit(100),
      serverSupabase.from("task_deadline_history").select("id,task_id,changed_by,new_due_date,reason,changed_at")
        .in("task_id", taskIds).neq("changed_by", userId).order("changed_at", { ascending: false }).limit(100),
    ]);
    if (comments.error || statuses.error || deadlines.error) return { ok: false };

    const items: Array<NotificationItem & { rank: number }> = [];
    const taskTitle = (taskId: string) => taskMap.get(taskId)?.title ?? "Công việc";
    const href = (taskId: string) => `/tasks/${taskId}`;

    const participantByTask = new Map(participantRows.map((row) => [row.task_id, row]));
    for (const task of tasks) {
      const participant = participantByTask.get(task.id);
      const directlyAssigned = task.assignee_id === userId || task.owner_id === userId;
      const assignedAt = participant?.assigned_at ?? task.created_at;
      if ((directlyAssigned || (participant && participant.assignment_role !== "watcher")) && assignedAt >= assignmentCutoff()) {
        items.push({
          key: `assignment:${task.id}:${userId}`,
          kind: "assignment",
          title: "Công việc mới được giao",
          message: task.title,
          href: href(task.id), createdAt: assignedAt, unread: true, rank: 2,
        });
      }
    }

    const today = todayInVietnam();
    for (const task of tasks) {
      if (!task.due_date || ["done", "cancelled"].includes(task.status)) continue;
      const days = dateDiff(today, task.due_date);
      if (days > 3) continue;
      const message = days < 0
        ? `Đã quá hạn ${Math.abs(days)} ngày · ${task.title}`
        : days === 0 ? `Đến hạn hôm nay · ${task.title}`
          : `Còn ${days} ngày · ${task.title}`;
      items.push({
        key: `deadline:${task.id}:${task.due_date}`,
        kind: "deadline",
        title: days < 0 ? "Công việc quá hạn" : "Công việc sắp đến hạn",
        message,
        href: href(task.id), createdAt: new Date().toISOString(), unread: true, rank: 0,
      });
    }

    for (const row of comments.data ?? []) {
      const author = (row.staff_users as unknown as { full_name?: string } | null)?.full_name ?? "Một thành viên";
      const content = String(row.content ?? "").replace(/\s+/g, " ").trim();
      items.push({
        key: `comment:${row.id}`,
        kind: "comment",
        title: `${author} đã bình luận`,
        message: `${taskTitle(row.task_id)} · ${content.slice(0, 140)}`,
        href: href(row.task_id), createdAt: row.created_at, unread: true, rank: 1,
      });
    }
    for (const row of statuses.data ?? []) {
      items.push({
        key: `status:${row.id}`,
        kind: "status",
        title: "Trạng thái công việc thay đổi",
        message: `${taskTitle(row.task_id)} → ${statusLabels[row.to_status] ?? row.to_status}${row.reason ? ` · ${row.reason}` : ""}`,
        href: href(row.task_id), createdAt: row.created_at, unread: true, rank: 1,
      });
    }
    for (const row of deadlines.data ?? []) {
      items.push({
        key: `deadline-change:${row.id}`,
        kind: "deadline_change",
        title: "Deadline đã được thay đổi",
        message: `${taskTitle(row.task_id)} → ${row.new_due_date ? formatDate(row.new_due_date) : "Không có hạn"}${row.reason ? ` · ${row.reason}` : ""}`,
        href: href(row.task_id), createdAt: row.changed_at, unread: true, rank: 1,
      });
    }

    items.sort((a, b) => a.rank - b.rank || b.createdAt.localeCompare(a.createdAt));
    const visible = items.slice(0, 60);
    const keys = visible.map((item) => item.key);
    const reads = keys.length
      ? await serverSupabase.from("user_notification_reads").select("notification_key")
        .eq("user_id", userId).in("notification_key", keys)
      : { data: [], error: null };
    if (reads.error) return { ok: false };
    const readKeys = new Set((reads.data ?? []).map((row) => row.notification_key));
    return {
      ok: true,
      items: visible.map((item) => ({
        key: item.key, kind: item.kind, title: item.title, message: item.message,
        href: item.href, createdAt: item.createdAt, unread: !readKeys.has(item.key),
      })),
    };
  },

  async markRead(userId: string, keys: string[]) {
    if (!keys.length) return { ok: true as const };
    const rows = keys.map((notificationKey) => ({
      user_id: userId, notification_key: notificationKey, read_at: new Date().toISOString(),
    }));
    const { error } = await serverSupabase.from("user_notification_reads")
      .upsert(rows, { onConflict: "user_id,notification_key" });
    return error ? { ok: false as const } : { ok: true as const };
  },
};
