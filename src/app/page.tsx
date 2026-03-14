"use client";

import Link from "next/link";
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
  staff_users?: { full_name: string } | null;
};

const statusLabel: Record<ItTask["status"], string> = {
  new: "Mới",
  in_progress: "Đang xử lý",
  pending_review: "Chờ xác nhận",
  done: "Hoàn tất",
  rejected: "Từ chối",
};

const statusClass: Record<ItTask["status"], string> = {
  new: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-sky-100 text-sky-700",
  pending_review: "bg-violet-100 text-violet-700",
  done: "bg-emerald-100 text-emerald-700",
  rejected: "bg-slate-200 text-slate-700",
};

const categoryOptions = ["Máy tính", "Email", "Phần mềm", "Mạng", "Máy in", "Tài khoản", "Khác"];

export default function Home() {
  const router = useRouter();
  const { loading: authLoading, user, logout } = useAuth();

  const [itDepartment, setItDepartment] = useState<Department | null>(null);
  const [tasks, setTasks] = useState<ItTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Đang tải...");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Máy tính");
  const [description, setDescription] = useState("");
  const [ultraId, setUltraId] = useState("");
  const [ultraPass, setUltraPass] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
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
      .select("id,title,description,priority,status,created_at,staff_users!tasks_created_by_fkey(full_name)")
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

    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const timePart = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const ticketCode = `IT-${datePart}-${timePart}`;

    setSubmitting(true);
    let attachmentUrl: string | null = null;

    if (attachmentFile) {
      const fileName = `it-${Date.now()}-${attachmentFile.name}`;
      const upload = await supabase.storage.from("task-files").upload(fileName, attachmentFile, { upsert: true });
      if (upload.error) {
        setMessage(`❌ Upload file lỗi: ${upload.error.message}`);
        setSubmitting(false);
        return;
      }
      const pub = supabase.storage.from("task-files").getPublicUrl(fileName);
      attachmentUrl = pub.data.publicUrl;
    }

    const combinedDescription = [
      `Mảng yêu cầu: ${category}`,
      description.trim() ? `Chi tiết: ${description.trim()}` : null,
      ultraId.trim() ? `UltraViewer ID: ${ultraId.trim()}` : null,
      ultraPass.trim() ? `UltraViewer Pass: ${ultraPass.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase.from("tasks").insert({
      title: `[${ticketCode}] ${title.trim()}`, 
      description: combinedDescription || null,
      priority: "normal",
      status: "new",
      progress_percent: 0,
      department_id: itDepartment.id,
      assignment_mode: "department",
      created_by: user.id,
      owner_id: user.id,
      assignee_id: user.id,
      attachment_url: attachmentUrl,
      due_date: null,
    });

    if (error) {
      setMessage(`❌ ${error.message}`);
      setSubmitting(false);
      return;
    }

    setTitle("");
    setCategory("Máy tính");
    setDescription("");
    setUltraId("");
    setUltraPass("");
    setAttachmentFile(null);
    setMessage(`✅ Đã gửi yêu cầu IT. Mã ticket: ${ticketCode}`);
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
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src="/diditravel-logo.png" alt="DiDiTravel" className="h-20 w-20 rounded-2xl border border-sky-100 object-cover shadow-sm" />
              <div>
                <h1 className="text-xl font-bold text-sky-700 sm:text-2xl">IT Service Desk · DiDiTravel</h1>
                <p className="text-xs text-slate-500 sm:text-sm">Tiếp nhận yêu cầu xử lý các vấn đề IT nội bộ</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{user?.full_name}</span>
              <button onClick={logout} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">Đăng xuất</button>
            </div>
          </div>
        </div>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Tổng yêu cầu</p><p className="mt-1 text-2xl font-bold">{stats.total}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Đang mở</p><p className="mt-1 text-2xl font-bold text-amber-600">{stats.open}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Đã hoàn tất</p><p className="mt-1 text-2xl font-bold text-emerald-600">{stats.done}</p></div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">Tạo yêu cầu IT</h2>
          <p className="mb-3 text-xs text-slate-500">Phân loại đúng mảng để IT xử lý nhanh hơn.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm">Tiêu đề yêu cầu *</label>
              <input className="w-full rounded-lg border px-3 py-2" placeholder="Ví dụ: Không đăng nhập được email công ty" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm">Mảng liên quan</label>
              <select className="w-full rounded-lg border px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm">Mô tả vấn đề</label>
              <textarea className="min-h-24 w-full rounded-lg border px-3 py-2" placeholder="Mô tả chi tiết lỗi/sự cố..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm">UltraViewer ID</label>
              <input className="w-full rounded-lg border px-3 py-2" placeholder="Ví dụ: 123 456 789" value={ultraId} onChange={(e) => setUltraId(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm">UltraViewer Pass</label>
              <input className="w-full rounded-lg border px-3 py-2" placeholder="Ví dụ: 1234" value={ultraPass} onChange={(e) => setUltraPass(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm">File đính kèm</label>
              <input type="file" className="w-full rounded-lg border px-3 py-2" onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={createRequest} disabled={submitting} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60">
              {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
            </button>
            <p className="text-sm text-slate-600">{message}</p>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Danh sách yêu cầu IT</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Đang tải dữ liệu...</p>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Chưa có yêu cầu nào.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Yêu cầu</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Người yêu cầu</th>
                    <th className="px-3 py-2">Thời gian yêu cầu</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-t hover:bg-sky-50/40">
                      <td className="px-3 py-2 font-medium text-sky-700 underline">
                        <Link href={`/tasks/${t.id}`}>{t.title}</Link>
                      </td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass[t.status]}`}>{statusLabel[t.status]}</span></td>
                      <td className="px-3 py-2">{t.staff_users?.full_name ?? "-"}</td>
                      <td className="px-3 py-2">{new Date(t.created_at).toLocaleString("vi-VN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
