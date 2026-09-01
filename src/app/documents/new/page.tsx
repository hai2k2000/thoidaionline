"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { assignDocument, createDocument, listDocuments, type DocumentDirection, type OfficialDocument } from "@/lib/services";
import { errorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

type StaffUser = { id: string; full_name: string; username?: string | null };

export default function DocumentCreatePage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule } = useAuth();
  const { notify } = useActionFeedback();
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState<OfficialDocument[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [message, setMessage] = useState("Đang tải...");

  const [docCode, setDocCode] = useState("");
  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState<DocumentDirection>("incoming");

  const [documentId, setDocumentId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const loadData = async () => {
    const [docsRes, usersResponse] = await Promise.all([
      listDocuments(),
      fetch("/api/documents?options=1", { cache: "no-store" }),
    ]);

    if (!docsRes.ok) return setMessage(`❌ ${docsRes.error}`);
    const usersPayload = await usersResponse.json().catch(() => null) as { error?: string; users?: StaffUser[] } | null;
    if (!usersResponse.ok) return setMessage(`❌ ${usersPayload?.error || "Không thể tải danh sách người xử lý."}`);

    setRows(docsRes.data);
    setStaffUsers(usersPayload?.users ?? []);
    setMessage(`✅ Đã tải ${docsRes.data.length} tài liệu.`);
  };

  const onCreate = async () => {
    if (busy) return; setBusy(true);
    try { const result = await createDocument({ doc_code: docCode, title, direction }, user?.id);
    if (!result.ok) throw new Error(result.error);
    setDocCode("");
    setTitle("");
    notify("success", "Đã thêm tài liệu."); setMessage("✅ Đã thêm tài liệu."); await loadData();
    } catch (error) { const text = errorMessage(error, "Không thể thêm tài liệu."); notify("error", text); setMessage(`❌ ${text}`); } finally { setBusy(false); }
  };

  const onAssign = async () => {
    if (busy) return; setBusy(true);
    try { const result = await assignDocument(documentId, assigneeId, user?.id);
    if (!result.ok) throw new Error(result.error);
    notify("success", "Đã giao xử lý tài liệu."); setMessage("✅ Đã giao xử lý tài liệu."); await loadData();
    } catch (error) { const text = errorMessage(error, "Không thể giao xử lý tài liệu."); notify("error", text); setMessage(`❌ ${text}`); } finally { setBusy(false); }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("documents")) return void router.push("/");
    const t = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, router]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/documents/new" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Thêm tài liệu</h1>
          </div>

        <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold">Thêm tài liệu mới</h2>
          <p className="mt-1 text-sm text-slate-500">Tạo hồ sơ tài liệu trước khi giao người phụ trách xử lý.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <label className="grid gap-1.5 text-sm font-semibold md:col-span-1">Mã tài liệu <span className="font-normal text-slate-500">(bỏ trống để tự sinh)</span><input aria-label="Mã tài liệu" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={docCode} onChange={(e) => setDocCode(e.target.value)} /></label>
            <label className="grid gap-1.5 text-sm font-semibold md:col-span-2">Tiêu đề<input aria-label="Tiêu đề tài liệu" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className="grid gap-1.5 text-sm font-semibold">Loại tài liệu<select aria-label="Loại tài liệu" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={direction} onChange={(e) => setDirection(e.target.value as DocumentDirection)}>
              <option value="contract">Hợp đồng</option>
              <option value="incoming">Công văn đến</option>
              <option value="outgoing">Công văn đi</option>
              <option value="common">Tài liệu chung</option>
            </select></label>
            <button disabled={busy} onClick={onCreate} className="min-h-11 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">{busy ? "Đang xử lý..." : "Thêm tài liệu"}</button>
          </div>

          <div className="mt-6 border-t pt-5"><h3 className="text-lg font-semibold">Giao xử lý tài liệu</h3><p className="mt-1 text-sm text-slate-500">Chọn tài liệu và người xử lý để bắt đầu theo dõi tiến độ.</p></div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-semibold">Tài liệu<select aria-label="Chọn tài liệu" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
              <option value="">Chọn tài liệu</option>
              {rows.map((d) => <option key={d.id} value={d.id}>{d.doc_code} - {d.title}</option>)}
            </select></label>
            <label className="grid gap-1.5 text-sm font-semibold">Người xử lý<select aria-label="Chọn người xử lý" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Chọn người xử lý</option>
              {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.username ?? "-"})</option>)}
            </select></label>
            <button disabled={busy} onClick={onAssign} className="min-h-11 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50">{busy ? "Đang xử lý..." : "Giao xử lý"}</button>
          </div>

          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>
        </div>
      </div>
    </main>
  );
}
