"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { OfficialDocument } from "@/lib/services";

const urgencyLabel: Record<string, string> = {
  normal: "Bình thường",
  important: "Quan trọng",
  urgent: "Khẩn",
};

const confidentialityLabel: Record<string, string> = {
  normal: "Thường",
  internal: "Nội bộ",
  secret: "Mật",
};

const docStatusLabel: Record<string, string> = {
  new: "Mới",
  in_progress: "Đang xử lý",
  done: "Hoàn thành",
  archived: "Lưu trữ",
  todo: "Chờ xử lý",
};

type Assignment = {
  id: string;
  assignee_id: string | null;
  due_date: string | null;
  status: string | null;
  staff_users?: { full_name?: string | null; username?: string | null } | null;
};

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { loading: authLoading, user, logout, canAccessModule } = useAuth();

  const [doc, setDoc] = useState<OfficialDocument | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [message, setMessage] = useState("Đang tải...");

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("documents")) return void router.push("/");

    const id = String(params?.id ?? "");
    if (!id) return;

    const load = async () => {
      const [docRes, assignRes] = await Promise.all([
        supabase.from("official_documents").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("document_assignments")
          .select("id,assignee_id,due_date,status,staff_users!document_assignments_assignee_id_fkey(full_name,username)")
          .eq("document_id", id)
          .order("assigned_at", { ascending: false }),
      ]);

      if (docRes.error) return setMessage(`❌ ${docRes.error.message}`);
      if (!docRes.data) return setMessage("❌ Không tìm thấy công văn.");
      if (assignRes.error) return setMessage(`❌ ${assignRes.error.message}`);

      setDoc(docRes.data as OfficialDocument);
      setAssignments((assignRes.data ?? []) as Assignment[]);
      setMessage("✅ Đã tải chi tiết công văn.");
    };

    void load();
  }, [authLoading, user, canAccessModule, router, params?.id]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Chi tiết công văn</h1>
          <div className="mt-2">
            <AppNav currentPath="/documents" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>

        <p className="mb-3 text-sm text-slate-600">{message}</p>

        <section className="rounded-xl border bg-white p-4">
          <div className="mb-3">
            <Link href="/documents" className="inline-flex items-center rounded border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100 px-2 py-1 text-sm font-semibold text-orange-800 hover:from-orange-100 hover:to-amber-200">
              ← Quay lại danh sách công văn
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div><b>Mã công văn:</b> {doc?.doc_code ?? "-"}</div>
            <div><b>Loại:</b> {doc?.direction === "incoming" ? "Công văn đến" : "Công văn đi"}</div>
            <div className="md:col-span-2"><b>Tiêu đề:</b> {doc?.title ?? "-"}</div>
            <div><b>Mức độ khẩn:</b> {urgencyLabel[doc?.urgency ?? "normal"] ?? (doc?.urgency ?? "-")}</div>
            <div><b>Bảo mật:</b> {confidentialityLabel[doc?.confidentiality ?? "normal"] ?? (doc?.confidentiality ?? "-")}</div>
            <div><b>Trạng thái:</b> {docStatusLabel[doc?.status ?? "new"] ?? (doc?.status ?? "-")}</div>
            <div><b>Hạn xử lý:</b> {doc?.processing_deadline ? new Date(doc.processing_deadline).toLocaleDateString("vi-VN") : "-"}</div>
            <div className="md:col-span-2"><b>Tóm tắt:</b> {doc?.summary ?? "-"}</div>
            <div className="md:col-span-2"><b>Ghi chú:</b> {doc?.note ?? "-"}</div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4 overflow-auto">
          <h2 className="mb-2 text-lg font-semibold">Danh sách đã giao xử lý</h2>
          <table className="table-soft-red min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2">Người xử lý</th>
                <th className="px-2 py-2">Username</th>
                <th className="px-2 py-2">Hạn</th>
                <th className="px-2 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td className="px-2 py-2">{a.staff_users?.full_name ?? "-"}</td>
                  <td className="px-2 py-2">{a.staff_users?.username ?? "-"}</td>
                  <td className="px-2 py-2">{a.due_date ? new Date(a.due_date).toLocaleDateString("vi-VN") : "-"}</td>
                  <td className="px-2 py-2">{a.status ?? "todo"}</td>
                </tr>
              ))}
              {assignments.length === 0 ? (
                <tr><td colSpan={4} className="px-2 py-4 text-slate-500">Chưa giao cho ai.</td></tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
