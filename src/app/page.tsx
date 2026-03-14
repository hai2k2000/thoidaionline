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

const priorityClass: Record<ItTask["priority"], string> = {
  low: "bg-slate-100 text-slate-700",
  normal: "bg-sky-100 text-sky-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-rose-100 text-rose-700",
};

const statusClass: Record<ItTask["status"], string> = {
  new: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-sky-100 text-sky-700",
  pending_review: "bg-violet-100 text-violet-700",
  done: "bg-emerald-100 text-emerald-700",
  rejected: "bg-slate-200 text-slate-700",
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

    const depRes = await supabase.from("departments").select("id,code,name").eq("code", "it").limit(1).maybeSingle();

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
    const urgent = tasks.filter((t) => t.priority === "urgent" && t.status !== "done").length;
    return { total, open, done, urgent };
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
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src="/diditravel-logo.png" alt="DiDiTravel" className="h-11 w-11 rounded-full border border-sky-100 object-cover" />
              <div>
                <h1 className="text-xl font-bold text-sky-700 sm:text-2xl">IT Service Desk · DiDiTravel</h1>
                <p className="text-xs text-slate-500 sm:text-sm">Tiếp nhận và xử lý yêu cầu hỗ trợ kỹ thuật nội bộ</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{user?.full_name}</span>
              <button onClick={logout} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">
                Đăng xuất
              </button>
            </div>
          </div>
        </div>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Tổng yêu cầu</p><p className="mt-1 text-2xl font-bold">{stats.total}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Đang mở</p><p className="mt-1 text-2xl font-bold text-amber-600">{stats.open}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Khẩn chưa xử lý</p><p className="mt-1 text-2xl font-bold text-rose-600">{stats.urgent}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Đã hoàn tất</p><p className="mt-1 text-2xl font-bold text-emerald-600">{stats.done}</p></div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
            <h2 className="mb-1 text-lg font-semibold">Tạo yêu cầu IT</h2>
            <p className="mb-3 text-xs text-slate-500">Mô tả càng rõ, IT xử lý càng nhanh.</p>
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Ví dụ: Không in được máy in tầng 2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className="min-h-28 w-full rounded-lg border px-3 py-2"
                placeholder="Mô tả chi tiết: thiết bị, lỗi hiển thị, thời điểm xảy ra, ảnh hưởng công việc..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <select className="rounded-lg border px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value as ItTask["priority"])}>
                  <option value="low">Ưu tiên thấp</option>
                  <option value="normal">Ưu tiên bình thường</option>
                  <option value="high">Ưu tiên cao</option>
                  <option value="urgent">Ưu tiên khẩn</option>
                </select>
                <button
                  onClick={createRequest}
                  disabled={submitting}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
                >
                  {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{message}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Danh sách yêu cầu IT</h2>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-700">Phòng: {itDepartment?.name || "IT"}</span>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">Đang tải dữ liệu...</p>
            ) : tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Chưa có yêu cầu nào. Hãy tạo yêu cầu IT đầu tiên.
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => (
                  <div key={t.id} className="rounded-xl border border-slate-200 p-3 transition hover:border-sky-200 hover:bg-sky-50/30">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{t.title}</p>
                        {t.description ? <p className="mt-1 text-sm text-slate-600">{t.description}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${priorityClass[t.priority]}`}>{priorityLabel[t.priority]}</span>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass[t.status]}`}>{statusLabel[t.status]}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Người tạo: {t.staff_users?.full_name ?? "-"}</span>
                      <span>Thời gian: {new Date(t.created_at).toLocaleString("vi-VN")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
