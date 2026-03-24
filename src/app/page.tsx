"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import AppNav from "@/components/AppNav";

type Department = { id: string; name: string }; 
type AssignmentType = "individual" | "group" | "department";
type User = { id: string; full_name: string; department_id: string | null };
type Task = {
  id: string;
  assignee_id?: string | null;
  owner_id?: string | null;
  title: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "new" | "in_progress" | "pending_review" | "done" | "rejected";
  progress_percent: number;
  due_date: string | null;
  attachment_url?: string | null;
  assignment_mode?: "individual" | "multi_user" | "department" | "mixed";
  departments?: { name: string } | null;
  owner?: { full_name: string } | null;
  task_assignees?: { user_id: string; assignment_role: string; staff_users?: { full_name: string } | null }[];
};

type ProgressLog = {
  id: string;
  old_progress: number | null;
  new_progress: number;
  note: string | null;
  created_at: string;
  tasks?: { title: string } | null;
  staff_users?: { full_name: string } | null;
};

const statusLabel: Record<Task["status"], string> = {
  new: "Mới",
  in_progress: "Đang làm",
  pending_review: "Chờ duyệt",
  done: "Hoàn thành",
  rejected: "Trả lại",
};

const priorityLabel: Record<Task["priority"], string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn",
};

export default function Home() {
  const router = useRouter();
  const { loading: authLoading, user, logout, hasPermission } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [message, setMessage] = useState("Đang tải dữ liệu...");
  const [sendingReminder, setSendingReminder] = useState(false);
  const [sendingDocReminder, setSendingDocReminder] = useState(false);
  const [hrCount, setHrCount] = useState(0);
  const [assetInUseCount, setAssetInUseCount] = useState(0);
  const [docOverdueCount, setDocOverdueCount] = useState(0);
  const [reviewPendingCount, setReviewPendingCount] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("individual");
  const [assignWholeDepartment, setAssignWholeDepartment] = useState(false);
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [dueDate, setDueDate] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | "due_soon" | "overdue">("all");
  const taskListRef = useRef<HTMLElement | null>(null);

  const loadAll = async () => {
    const canViewAllTasks = hasPermission("can_edit_all_tasks");

    const taskQuery = supabase
      .from("tasks")
      .select("id, assignee_id, title, priority, status, progress_percent, due_date, attachment_url, assignment_mode, departments(name), owner:staff_users!tasks_owner_id_fkey(full_name), task_assignees(user_id, assignment_role, staff_users(full_name))")
      .order("created_at", { ascending: false })
      .limit(300);

    const logQuery = supabase
      .from("task_progress_logs")
      .select("id, old_progress, new_progress, note, created_at, tasks!task_progress_logs_task_id_fkey(title), staff_users!task_progress_logs_user_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(30);

    const today = new Date().toISOString().slice(0, 10);
    const [depRes, userRes, taskRes, logRes, hrRes, assetRes, docRes, reviewRes] = await Promise.all([
      supabase.from("departments").select("id, name").eq("active", true).order("name"),
      supabase.from("staff_users").select("id, full_name, department_id").eq("active", true).order("full_name"),
      taskQuery,
      (canViewAllTasks ? logQuery : logQuery.eq("user_id", user?.id ?? "")),
      supabase.from("employee_profiles").select("*", { count: "exact", head: true }),
      supabase.from("assets").select("*", { count: "exact", head: true }).eq("status", "in_use"),
      supabase.from("official_documents").select("*", { count: "exact", head: true }).lte("processing_deadline", today).neq("status", "done"),
      supabase.from("performance_reviews").select("*", { count: "exact", head: true }).in("status", ["submitted", "reviewed"]),
    ]);

    if (depRes.error || userRes.error || taskRes.error || logRes.error || hrRes.error || assetRes.error || docRes.error || reviewRes.error) {
      setMessage(`❌ ${depRes.error?.message || userRes.error?.message || taskRes.error?.message || logRes.error?.message || hrRes.error?.message || assetRes.error?.message || docRes.error?.message || reviewRes.error?.message}`);
      return;
    }

    setDepartments((depRes.data ?? []) as Department[]);
    setUsers((userRes.data ?? []) as User[]);
    const fetchedTasks = (taskRes.data ?? []) as unknown as Task[];
    const visibleTasks = canViewAllTasks
      ? fetchedTasks
      : fetchedTasks.filter((t) => t.assignee_id === user?.id || (t.task_assignees ?? []).some((a) => a.user_id === user?.id));
    setTasks(visibleTasks);
    setLogs((logRes.data ?? []) as unknown as ProgressLog[]);
    setHrCount(hrRes.count ?? 0);
    setAssetInUseCount(assetRes.count ?? 0);
    setDocOverdueCount(docRes.count ?? 0);
    setReviewPendingCount(reviewRes.count ?? 0);
    setMessage("✅ Đã tải dữ liệu.");
  };

  const applyDepartmentAssignees = (targetDepartmentId?: string) => {
    const deptId = targetDepartmentId || departmentId;
    if (!deptId) return setMessage("❌ Vui lòng chọn phòng ban trước."), undefined;

    const deptUsers = users.filter((u) => u.department_id === deptId);
    if (deptUsers.length === 0) return setMessage("❌ Phòng ban này chưa có nhân sự active."), undefined;

    const owner = deptUsers.find((u) => u.id === assigneeId) ?? deptUsers[0];
    setAssigneeId(owner.id);
    setCollaboratorIds(deptUsers.filter((u) => u.id !== owner.id).map((u) => u.id));
    setMessage(`✅ Đã tự động nạp ${deptUsers.length} nhân sự của phòng ban.`);
  };

  const createTask = async () => {
    if (!title.trim()) return setMessage("❌ Vui lòng nhập tiêu đề công việc."), undefined;
    if (!description.trim()) return setMessage("❌ Vui lòng nhập mô tả công việc."), undefined;
    if (assignmentType === "department" && !departmentId) return setMessage("❌ Chưa chọn phòng ban để giao việc."), undefined;
    if (!dueDate) return setMessage("❌ Vui lòng chọn deadline."), undefined;

    const usersByDepartment = users.filter((u) => u.department_id === departmentId);
    const effectiveAssigneeId = assignmentType === "department"
      ? (assigneeId || usersByDepartment[0]?.id || "")
      : assigneeId;

    const effectiveCollaboratorIds = assignmentType === "individual"
      ? []
      : (assignmentType === "department"
        ? usersByDepartment.filter((u) => u.id !== effectiveAssigneeId).map((u) => u.id)
        : collaboratorIds);

    if (!effectiveAssigneeId) return setMessage("❌ Vui lòng chọn người chịu trách nhiệm chính."), undefined;
    if (assignmentType === "group" && effectiveAssigneeId === user?.id) return setMessage("❌ Không thể giao việc nhóm với Owner chính là chính bạn."), undefined;
    if (assignmentType === "group" && effectiveCollaboratorIds.length === 0) return setMessage("❌ Vui lòng chọn ít nhất 1 thành viên."), undefined;

    let attachmentUrl: string | null = null;
    if (attachmentFile) {
      const fileName = `${Date.now()}-${attachmentFile.name}`;
      const { error: uploadError } = await supabase.storage.from("task-files").upload(fileName, attachmentFile, {
        upsert: true,
      });
      if (uploadError) return setMessage(`❌ Upload file lỗi: ${uploadError.message}`), undefined;
      const { data: pub } = supabase.storage.from("task-files").getPublicUrl(fileName);
      attachmentUrl = pub.publicUrl;
    }

    const normalizedGroupMembers = assignmentType === "group"
      ? Array.from(new Set([...effectiveCollaboratorIds, effectiveAssigneeId].filter(Boolean)))
      : [];

    const uniqueCollaborators = Array.from(new Set((assignmentType === "group" ? normalizedGroupMembers : effectiveCollaboratorIds)
      .filter((id) => id && id !== effectiveAssigneeId)));

    const { data: insertedTask, error } = await supabase.from("tasks").insert({
      title: title.trim(),
      description: description.trim(),
      department_id: departmentId || null,
      assignee_id: effectiveAssigneeId,
      owner_id: effectiveAssigneeId,
      assignment_mode: assignmentType === "department"
        ? "department"
        : assignmentType === "group"
          ? "mixed"
          : (uniqueCollaborators.length > 0 ? "multi_user" : "individual"),
      priority,
      due_date: dueDate || null,
      status: "new",
      progress_percent: 0,
      attachment_url: attachmentUrl,
    }).select("id").single();
    if (error || !insertedTask) return setMessage(`❌ ${error?.message || "Không tạo được công việc"}`), undefined;

    const assignmentRows = [
      { task_id: insertedTask.id, user_id: effectiveAssigneeId, assignment_role: "owner" },
      ...uniqueCollaborators.map((userId) => ({ task_id: insertedTask.id, user_id: userId, assignment_role: "assignee" })),
    ];

    const { error: assignError } = await supabase.from("task_assignees").upsert(assignmentRows, { onConflict: "task_id,user_id" });
    if (assignError) return setMessage(`❌ ${assignError.message}`), undefined;

    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("normal");
    setCollaboratorIds([]);
    setAttachmentFile(null);
    setMessage("✅ Đã tạo công việc.");
    await loadAll();
  };

  const updateTask = async (id: string, patch: Partial<Task>) => {
    const { error } = await supabase.from("tasks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return setMessage(`❌ ${error.message}`), undefined;
    await loadAll();
  };

  const sendDueSoonReminder = async () => {
    setSendingReminder(true);
    try {
      const r = await fetch("/api/notify/due-soon?days=3", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Không gửi được thông báo.");
      setMessage(`✅ Đã gửi nhắc việc. Kênh: ${(data.channels?.join(", ") || "chưa cấu hình")}. Số việc: ${data.count}.`);
    } catch (e) {
      setMessage(`❌ ${(e as Error).message}`);
    } finally {
      setSendingReminder(false);
    }
  };

  const sendOverdueDocReminder = async () => {
    setSendingDocReminder(true);
    try {
      const r = await fetch("/api/notify/doc-overdue", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Không gửi được cảnh báo công văn.");
      setMessage(`✅ Đã gửi cảnh báo công văn quá hạn. Kênh: ${(data.channels?.join(", ") || "chưa cấu hình")}. Số công văn: ${data.count}.`);
    } catch (e) {
      setMessage(`❌ ${(e as Error).message}`);
    } finally {
      setSendingDocReminder(false);
    }
  };

  const exportSummaryCsv = () => {
    window.open("/api/reports/summary", "_blank");
  };

  const stats = useMemo(() => ({ total: tasks.length, done: tasks.filter((t) => t.status === "done").length }), [tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date(new Date().toDateString());
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);

    return tasks.filter((t) => {
      const okStatus = !filterStatus || t.status === filterStatus;
      const okPriority = !filterPriority || t.priority === filterPriority;
      const okDept = !filterDepartment || t.departments?.name === filterDepartment;
      const okSearch = !q || t.title.toLowerCase().includes(q);

      let okQuick = true;
      if (quickFilter !== "all") {
        if (!t.due_date || t.status === "done") okQuick = false;
        else {
          const d = new Date(t.due_date);
          if (quickFilter === "due_soon") okQuick = d >= today && d <= threeDaysLater;
          if (quickFilter === "overdue") okQuick = d < today;
        }
      }

      return okStatus && okPriority && okDept && okSearch && okQuick;
    });
  }, [tasks, filterStatus, filterPriority, filterDepartment, search, quickFilter]);

  const activeTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === "new" || t.status === "in_progress" || t.status === "rejected"),
    [filteredTasks],
  );
  const pendingReviewTasks = useMemo(() => filteredTasks.filter((t) => t.status === "pending_review"), [filteredTasks]);
  const doneTasks = useMemo(() => filteredTasks.filter((t) => t.status === "done"), [filteredTasks]);

  const myPendingReviewCount = useMemo(() => {
    if (!user?.id) return 0;
    return tasks.filter((t) => t.owner_id === user.id && t.status === "pending_review").length;
  }, [tasks, user]);

  const dueSoonCount = useMemo(() => {
    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(now.getDate() + 3);
    return tasks.filter((t) => {
      if (!t.due_date || t.status === "done") return false;
      const d = new Date(t.due_date);
      return d >= new Date(now.toDateString()) && d <= threeDaysLater;
    }).length;
  }, [tasks]);

  const overdueCount = useMemo(() => {
    const today = new Date(new Date().toDateString());
    return tasks.filter((t) => t.status !== "done" && t.due_date && new Date(t.due_date) < today).length;
  }, [tasks]);

  const assignableUsers = useMemo(() => {
    if (assignWholeDepartment && departmentId) return users.filter((u) => u.department_id === departmentId);
    return users;
  }, [users, assignWholeDepartment, departmentId]);

  const jumpToTaskList = () => {
    setTimeout(() => {
      taskListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };


  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    const t = setTimeout(() => {
      void loadAll();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, router]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl p-6 lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-3xl font-bold">Quản lý công việc</h1>
          </div>


        <section className="mt-4 rounded-xl border bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={loadAll} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Tải dữ liệu</button>
            <button onClick={sendDueSoonReminder} disabled={sendingReminder} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
              {sendingReminder ? "Đang gửi nhắc việc..." : "Nhắc việc sắp đến hạn"}
            </button>
            <button onClick={sendOverdueDocReminder} disabled={sendingDocReminder} className="rounded bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
              {sendingDocReminder ? "Đang gửi cảnh báo..." : "Cảnh báo công văn quá hạn"}
            </button>
            <button onClick={exportSummaryCsv} className="rounded bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-300">
              Xuất báo cáo CSV
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Tạo công việc</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium">Tiêu đề công việc *</label>
            <input className="rounded border px-3 py-2" placeholder="Ví dụ: Hoàn thiện kế hoạch nội dung tuần" value={title} onChange={(e) => setTitle(e.target.value)} />

            <label className="text-sm font-medium">Mô tả công việc *</label>
            <textarea
              className="min-h-24 rounded border px-3 py-2"
              placeholder="Mô tả chi tiết yêu cầu, đầu ra mong muốn..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <label className="text-sm font-medium">Kiểu giao việc *</label>
            <select
              className="rounded border px-3 py-2"
              value={assignmentType}
              onChange={(e) => {
                const nextType = e.target.value as AssignmentType;
                setAssignmentType(nextType);
                setAssignWholeDepartment(nextType === "department");
                if (nextType !== "group") {
                  setCollaboratorIds([]);
                }
                if (nextType === "department") {
                  setAssigneeId("");
                }
              }}
            >
              <option value="individual">Cá nhân</option>
              <option value="group">Nhóm</option>
              <option value="department">Phòng ban</option>
            </select>

            {assignmentType !== "department" ? (
              <>
                <label className="text-sm font-medium">Owner chính *</label>
                <select
                  className="rounded border px-3 py-2"
                  value={assigneeId}
                  onChange={(e) => {
                    const nextOwnerId = e.target.value;
                    setAssigneeId(nextOwnerId);
                    if (assignmentType === "group" && nextOwnerId) {
                      setCollaboratorIds((prev) => prev.includes(nextOwnerId) ? prev : [...prev, nextOwnerId]);
                    }
                  }}
                >
                  <option value="">-- Chọn người chịu trách nhiệm chính --</option>
                  {(assignmentType === "group" ? users : assignableUsers).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </>
            ) : null}

            {assignmentType === "group" ? (
              <>
                <label className="text-sm font-medium">Thành viên nhóm (chọn nhiều) *</label>
                <div className="max-h-40 overflow-auto rounded border bg-white">
                  {users.filter((u) => u.id !== assigneeId).map((u) => {
                    const checked = collaboratorIds.includes(u.id);
                    return (
                      <label key={u.id} className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition ${checked ? "bg-gradient-to-r from-cyan-50 to-blue-200 text-blue-800" : "hover:bg-neutral-100"}`}>
                        <span>{u.full_name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setCollaboratorIds((prev) => {
                              if (e.target.checked) return Array.from(new Set([...prev, u.id]));
                              return prev.filter((x) => x !== u.id);
                            });
                          }}
                        />
                      </label>
                    );
                  })}
                  {users.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">Chưa có nhân sự active.</p> : null}
                </div>
              </>
            ) : null}

            {assignmentType === "group" ? (
              <>
                <label className="text-sm font-medium">Danh sách nhóm đã chọn</label>
                <div className="rounded border bg-slate-50 p-2 text-sm">
                  <p><b>Người chịu trách nhiệm chính:</b> {users.find((u) => u.id === assigneeId)?.full_name ?? "-"}</p>
                  <p><b>Thành viên:</b> {collaboratorIds.map((id) => users.find((u) => u.id === id)?.full_name).filter(Boolean).join(", ") || "-"}</p>
                </div>
              </>
            ) : null}

            <label className="text-sm font-medium">Deadline *</label>
            <input type="date" className="rounded border px-3 py-2" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

            {assignmentType === "department" ? (
              <>
                <label className="text-sm font-medium">Phòng ban</label>
                <div className="space-y-2">
                  <select
                    className="w-full rounded border px-3 py-2"
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value);
                      applyDepartmentAssignees(e.target.value);
                    }}
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </>
            ) : null}

            <label className="text-sm font-medium">Mức ưu tiên</label>
            <select className="rounded border px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])}>
              <option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option><option value="urgent">Khẩn</option>
            </select>

            <label className="text-sm font-medium">File đính kèm</label>
            <input type="file" className="rounded border px-3 py-2" onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)} />
          </div>
          <p className="mt-2 text-xs text-slate-500">(*) Bắt buộc: tiêu đề, mô tả, kiểu giao việc, deadline. Cá nhân: chọn owner. Nhóm: chọn owner + thành viên. Phòng ban: chỉ chọn phòng ban.</p>
          {hasPermission("can_create_task") ? (
            <button onClick={createTask} className="mt-3 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Tạo việc</button>
          ) : (
            <p className="mt-3 text-sm text-amber-700">Bạn không có quyền tạo công việc.</p>
          )}
        </section>

        </div>
      </div>
    </main>
  );
}
