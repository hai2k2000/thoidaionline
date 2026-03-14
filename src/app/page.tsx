"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type Department = { id: string; name: string }; 
type AssignmentType = "individual" | "group" | "department";
type User = { id: string; full_name: string; department_id: string | null };
type Task = {
  id: string;
  assignee_id?: string | null;
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
  const [page, setPage] = useState(1);
  const pageSize = 10;

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

    const [depRes, userRes, taskRes, logRes] = await Promise.all([
      supabase.from("departments").select("id, name").eq("active", true).order("name"),
      supabase.from("staff_users").select("id, full_name, department_id").eq("active", true).order("full_name"),
      taskQuery,
      (canViewAllTasks ? logQuery : logQuery.eq("user_id", user?.id ?? "")),
    ]);

    if (depRes.error || userRes.error || taskRes.error || logRes.error) {
      setMessage(`❌ ${depRes.error?.message || userRes.error?.message || taskRes.error?.message || logRes.error?.message}`);
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

  const stats = useMemo(() => ({ total: tasks.length, done: tasks.filter((t) => t.status === "done").length }), [tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      const okStatus = !filterStatus || t.status === filterStatus;
      const okPriority = !filterPriority || t.priority === filterPriority;
      const okDept = !filterDepartment || t.departments?.name === filterDepartment;
      const okSearch = !q || t.title.toLowerCase().includes(q);
      return okStatus && okPriority && okDept && okSearch;
    });
  }, [tasks, filterStatus, filterPriority, filterDepartment, search]);

  const pagedTasks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, page]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));

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
      <div className="mx-auto max-w-7xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-3xl font-bold">Quản lý công việc</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" className="rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Công việc</Link>
            <Link href="/users" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-red-100 hover:text-red-700">User</Link>
            <Link href="/departments" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-red-100 hover:text-red-700">Phòng ban</Link>
            <Link href="/permissions" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-red-100 hover:text-red-700">Phân quyền</Link>
            <Link href="/my-tasks" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-red-100 hover:text-red-700">Theo user</Link>
            <span className="text-xs text-slate-600">{user?.full_name} ({user?.role_name})</span>
            <button onClick={logout} className="rounded bg-rose-600 px-3 py-2 text-sm font-semibold text-white">Đăng xuất</button>
          </div>
        </div>

        <section className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Tổng việc</p><p className="text-2xl font-bold">{stats.total}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Hoàn thành</p><p className="text-2xl font-bold text-emerald-600">{stats.done}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Sắp đến hạn (3 ngày)</p><p className="text-2xl font-bold text-amber-600">{dueSoonCount}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Đã quá hạn</p><p className="text-2xl font-bold text-rose-600">{overdueCount}</p></div>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={loadAll} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Tải dữ liệu</button>
            <button onClick={sendDueSoonReminder} disabled={sendingReminder} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
              {sendingReminder ? "Đang gửi nhắc việc..." : "Nhắc việc sắp đến hạn"}
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
                      <label key={u.id} className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition ${checked ? "bg-red-50 text-red-700" : "hover:bg-neutral-100"}`}>
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

        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Danh sách công việc</h2>
          <div className="mb-3 grid gap-2 md:grid-cols-4">
            <input className="rounded border px-3 py-2" placeholder="Tìm theo tiêu đề" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <select className="rounded border px-3 py-2" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
              <option value="">Tất cả trạng thái</option>
              <option value="new">Mới</option><option value="in_progress">Đang làm</option><option value="pending_review">Chờ duyệt</option><option value="done">Hoàn thành</option><option value="rejected">Trả lại</option>
            </select>
            <select className="rounded border px-3 py-2" value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }}>
              <option value="">Tất cả ưu tiên</option>
              <option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option><option value="urgent">Khẩn</option>
            </select>
            <select className="rounded border px-3 py-2" value={filterDepartment} onChange={(e) => { setFilterDepartment(e.target.value); setPage(1); }}>
              <option value="">Tất cả phòng ban</option>
              {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-2">Công việc</th>
                  <th className="px-2 py-2">Phòng</th>
                  <th className="px-2 py-2">Thực hiện</th>
                  <th className="px-2 py-2">Ưu tiên</th>
                  <th className="px-2 py-2">Đến hạn</th>
                  <th className="px-2 py-2">Tiến độ</th>
                  <th className="px-2 py-2">Trạng thái</th>
                  <th className="px-2 py-2">File</th>
                </tr>
              </thead>
              <tbody>
                {pagedTasks.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-2 py-2"><Link href={`/tasks/${t.id}`} className="text-blue-600 underline">{t.title}</Link></td>
                    <td className="px-2 py-2">{t.departments?.name ?? "-"}</td>
                    <td className="px-2 py-2">{t.owner?.full_name ?? "-"}{(t.task_assignees?.length ?? 0) > 1 ? ` +${(t.task_assignees?.length ?? 1) - 1}` : ""}</td>
                    <td className="px-2 py-2">{priorityLabel[t.priority]}</td>
                    <td className="px-2 py-2">{t.due_date ? new Date(t.due_date).toLocaleDateString("vi-VN") : "-"}</td>
                    <td className="px-2 py-2 min-w-36">
                      <div className="mb-1 h-2 rounded bg-slate-200"><div className="h-2 rounded bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, t.progress_percent))}%` }} /></div>
                      <input type="number" min={0} max={100} value={t.progress_percent} disabled={!hasPermission("can_edit_all_tasks")} onChange={(e) => updateTask(t.id, { progress_percent: Number(e.target.value || 0) })} className="w-20 rounded border px-2 py-1 disabled:opacity-50" />
                    </td>
                    <td className="px-2 py-2">
                      <select value={t.status} disabled={!hasPermission("can_edit_all_tasks")} onChange={(e) => updateTask(t.id, { status: e.target.value as Task["status"] })} className="rounded border px-2 py-1 disabled:opacity-50">
                        <option value="new">{statusLabel.new}</option>
                        <option value="in_progress">{statusLabel.in_progress}</option>
                        <option value="pending_review">{statusLabel.pending_review}</option>
                        <option value="done">{statusLabel.done}</option>
                        <option value="rejected">{statusLabel.rejected}</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      {t.attachment_url ? <a href={t.attachment_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Mở file</a> : "-"}
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 ? (<tr><td colSpan={8} className="px-2 py-6 text-center text-slate-500">Không có công việc phù hợp bộ lọc.</td></tr>) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span>Trang {page}/{totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border px-3 py-1 disabled:opacity-50">Trước</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded border px-3 py-1 disabled:opacity-50">Sau</button>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Lịch sử cập nhật tiến độ (Audit)</h2>
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="rounded border p-2 text-sm">
                <p><b>{l.tasks?.title ?? "Task"}</b> · {l.old_progress ?? 0}% → {l.new_progress}%</p>
                <p className="text-xs text-slate-500">{l.staff_users?.full_name ?? "User"} · {new Date(l.created_at).toLocaleString()} {l.note ? `· ${l.note}` : ""}</p>
              </div>
            ))}
            {logs.length === 0 ? <p className="text-sm text-slate-500">Chưa có lịch sử cập nhật.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
