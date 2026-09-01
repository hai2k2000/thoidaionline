"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
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

const assignmentStatusLabel: Record<string, string> = {
  todo: "Chờ xử lý",
  in_progress: "Đang xử lý",
  done: "Hoàn thành",
  overdue: "Quá hạn",
};

const directionLabel: Record<string, string> = {
  contract: "Hợp đồng",
  incoming: "Công văn đến",
  outgoing: "Công văn đi",
  common: "Tài liệu chung",
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
      const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { error?: string; document?: OfficialDocument; assignments?: Assignment[] } | null;
      if (!response.ok) return setMessage(`❌ ${payload?.error || "Không thể tải chi tiết công văn."}`);
      if (!payload?.document) return setMessage("❌ Không tìm thấy công văn.");

      setDoc(payload.document);
      setAssignments(payload.assignments ?? []);
      setMessage("✅ Đã tải chi tiết công văn.");
    };

    void load();
  }, [authLoading, user, canAccessModule, router, params?.id]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/documents" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Chi tiết công văn</h1>
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
            <div><b>Loại:</b> {directionLabel[doc?.direction ?? ""] ?? doc?.direction ?? "-"}</div>
            <div className="md:col-span-2"><b>Tiêu đề:</b> {doc?.title ?? "-"}</div>
            <div><b>Mức độ khẩn:</b> {urgencyLabel[doc?.urgency ?? "normal"] ?? (doc?.urgency ?? "-")}</div>
            <div><b>Bảo mật:</b> {confidentialityLabel[doc?.confidentiality ?? "normal"] ?? (doc?.confidentiality ?? "-")}</div>
            <div><b>Trạng thái:</b> {docStatusLabel[doc?.status ?? "new"] ?? (doc?.status ?? "-")}</div>
            <div><b>Hạn xử lý:</b> {doc?.processing_deadline ? new Date(doc.processing_deadline).toLocaleDateString("vi-VN") : "-"}</div>
            <div className="md:col-span-2"><b>Tóm tắt:</b> {doc?.summary ?? "-"}</div>
            <div className="md:col-span-2"><b>Ghi chú:</b> {doc?.note ?? "-"}</div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Danh sách đã giao xử lý</h2>
          <div className="table-scroll rounded-lg border border-slate-200" tabIndex={0} aria-label="Danh sách đã giao xử lý, cuộn ngang để xem thêm">
          <table className="table-soft-red data-table min-w-[760px] text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2">Người xử lý</th>
                <th scope="col" className="px-3 py-2">Tên đăng nhập</th>
                <th scope="col" className="px-3 py-2">Hạn</th>
                <th scope="col" className="px-3 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-semibold">{a.staff_users?.full_name ?? "-"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{a.staff_users?.username ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{a.due_date ? new Date(a.due_date).toLocaleDateString("vi-VN") : "-"}</td>
                  <td className="px-3 py-2"><span className={`table-status ${a.status === "done" ? "table-status-success" : a.status === "overdue" ? "table-status-danger" : a.status === "in_progress" ? "table-status-warning" : "table-status-neutral"}`}>{assignmentStatusLabel[a.status ?? "todo"] ?? (a.status ?? "-")}</span></td>
                </tr>
              ))}
              {assignments.length === 0 ? (
                <tr><td colSpan={4} className="px-2 py-4 text-slate-500">Chưa giao cho ai.</td></tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
