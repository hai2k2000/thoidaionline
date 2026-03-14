"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type Department = { id: string; code: string; name: string };

type ItTask = {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "new" | "in_progress" | "pending_review" | "done" | "rejected";
  created_at: string;
  due_date: string | null;
  staff_users?: { full_name: string } | null;
};

const priorityLabel: Record<ItTask["priority"], string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn",
};

const statusLabel: Record<ItTask["status"], string> = {
  new: "Mới",
  in_progress: "Đang xử lý",
  pending_review: "Chờ xác nhận",
  done: "Hoàn tất",
  rejected: "Từ chối",
};

export default function Home() {
  const router = useRouter();
  const { loading: authLoading, user, logout } = useAuth();

  const [itDepartment, setItDepartment] = useState<Department | null>(null);
  const [tasks, setTasks] = useState<ItTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Đang tải...");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ItTask["priority"]>("normal");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const depRes = await supabase
      .from("departments")
      .select("id,code,name")
      .eq("code", "it")
      .limit(1)
      .maybeSingle();

    if (depRes.error || !depRes.data) {
      setMessage("❌ Không tìm thấy phòng IT.");
      setLoading(false);
      return;
    }

    setItDepartment(depRes.data as Department);

    const taskRes = await supabase
      .from("tasks")
      .select("id,title,description,priority,status,created_at,due_date,staff_users!tasks_created_by_fkey(full_name)")
      .eq("department_id", depRes.data.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (taskRes.error) {
      setMessage(`❌ ${taskRes.error.message}`);
      setLoading(false);
      return;
    }

    setTasks((taskRes.data ?? []) as unknown as ItTask[]);
    setMessage("✅ Sẵn sàng tiếp nhận yêu cầu IT.");
    setLoading(false);
  };

  const createRequest = async () => {
    if (!user) return;
    if (!itDepartment) return setMessage("❌ Chưa lấy được thông tin phòng IT."), undefined;
    if (!title.trim()) return setMessage("❌ Vui lòng nhập tiêu đề yêu cầu."), undefined;

    setSubmitting(true);
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status: "new",
      progress_percent: 0,
      department_id: itDepartment.id,
      assignment_mode: "department",
      created_by: user.id,
      due_date: null,
    });

    if (error) {
      setMessage(`❌ ${error.message}`);
      setSubmitting(false);
      return;
    }

    setTitle("");
    setDescription("");
    setPriority("normal");
    setMessage("✅ Đã gửi yêu cầu IT.");
    setSubmitting(false);
    await loadData();
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const open = tasks.filter((t) => ["new", "in_progress", "pending_review"].includes(t.status)).length;
    const done = tasks.filter((t) => t.status === "done").length;
    return { total, open, done };
  }, [tasks]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void loadData();
  }, [authLoading, user]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/diditravel-logo.png" alt="DiDiTravel" className="h-10 w-10 rounded-full border border-sky-100 object-cover" />
            <div>
              <h1 className="text-2xl font-bold text-sky-700">Cổng Yêu Cầu IT · DiDiTravel</h1>
              <p className="text-xs text-slate-500">Tiếp nhận và xử lý các vấn đề kỹ thuật nội bộ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">{user?.full_name}</span>
            <button onClick={logout} className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white">Đăng xuất</button>
          </div>
        </div>

        <section className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Tổng yêu cầu</p><p className="text-2xl font-bold">{stats.total}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Đang mở</p><p className="text-2xl font-bold text-amber-600">{stats.open}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Đã hoàn tất</p><p className="text-2xl font-bold text-emerald-600">{stats.done}</p></div>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Tạo yêu cầu IT mới</h2>
          <div className="grid gap-3">
            <input
              className="rounded border px-3 py-2"
              placeholder="Tiêu đề sự cố / yêu cầu"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="min-h-24 rounded border px-3 py-2"
              placeholder="Mô tả chi tiết vấn đề (thiết bị, thời điểm, ảnh hưởng, mong muốn xử lý...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm">Mức ưu tiên:</label>
              <select className="rounded border px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value as ItTask["priority"])}>
                <option value="low">Thấp</option>
                <option value="normal">Bình thường</option>
                <option value="high">Cao</option>
                <option value="urgent">Khẩn</option>
              </select>
              <button
                onClick={createRequest}
                disabled={submitting}
                className="rounded bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
              >
                {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Danh sách yêu cầu IT</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Đang tải...</p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-2">Yêu cầu</th>
                    <th className="px-2 py-2">Ưu tiên</th>
                    <th className="px-2 py-2">Trạng thái</th>
                    <th className="px-2 py-2">Người tạo</th>
                    <th className="px-2 py-2">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-t align-top">
                      <td className="px-2 py-2">
                        <p className="font-medium">{t.title}</p>
                        {t.description ? <p className="mt-1 text-xs text-slate-600">{t.description}</p> : null}
                      </td>
                      <td className="px-2 py-2">{priorityLabel[t.priority]}</td>
                      <td className="px-2 py-2">{statusLabel[t.status]}</td>
                      <td className="px-2 py-2">{t.staff_users?.full_name ?? "-"}</td>
                      <td className="px-2 py-2">{new Date(t.created_at).toLocaleString("vi-VN")}</td>
                    </tr>
                  ))}
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-slate-500">Chưa có yêu cầu IT nào.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
