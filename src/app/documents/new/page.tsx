"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { assignDocument, createDocument, listDocuments, type OfficialDocument } from "@/lib/services";

type StaffUser = { id: string; full_name: string; username?: string | null };

export default function DocumentCreatePage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule } = useAuth();

  const [rows, setRows] = useState<OfficialDocument[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [message, setMessage] = useState("Đang tải...");

  const [docCode, setDocCode] = useState("");
  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState<"incoming" | "outgoing">("incoming");

  const [documentId, setDocumentId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const loadData = async () => {
    const [docsRes, usersRes] = await Promise.all([
      listDocuments(),
      supabase.from("staff_users").select("id,full_name,username").order("full_name"),
    ]);

    if (!docsRes.ok) return setMessage(`❌ ${docsRes.error}`);
    if (usersRes.error) return setMessage(`❌ ${usersRes.error.message}`);

    setRows(docsRes.data);
    setStaffUsers((usersRes.data ?? []) as StaffUser[]);
    setMessage(`✅ Đã tải ${docsRes.data.length} tài liệu.`);
  };

  const onCreate = async () => {
    const result = await createDocument({ doc_code: docCode, title, direction }, user?.id);
    if (!result.ok) return setMessage(`❌ ${result.error}`);
    setDocCode("");
    setTitle("");
    setMessage("✅ Đã thêm tài liệu.");
    await loadData();
  };

  const onAssign = async () => {
    const result = await assignDocument(documentId, assigneeId, user?.id);
    if (!result.ok) return setMessage(`❌ ${result.error}`);
    setMessage("✅ Đã giao xử lý tài liệu.");
    await loadData();
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

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Thêm tài liệu mới</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <input className="rounded border px-3 py-2" placeholder="Mã tài liệu (bỏ trống để tự sinh)" value={docCode} onChange={(e) => setDocCode(e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select className="rounded border px-3 py-2" value={direction} onChange={(e) => setDirection(e.target.value as "incoming" | "outgoing")}>
              <option value="incoming">Tài liệu đến</option>
              <option value="outgoing">Tài liệu đi</option>
            </select>
            <button onClick={onCreate} className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Thêm</button>
          </div>

          <h3 className="mt-4 mb-2 text-sm font-semibold">Giao xử lý tài liệu</h3>
          <div className="grid gap-2 md:grid-cols-3">
            <select className="rounded border px-3 py-2" value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
              <option value="">Chọn tài liệu</option>
              {rows.map((d) => <option key={d.id} value={d.id}>{d.doc_code} - {d.title}</option>)}
            </select>
            <select className="rounded border px-3 py-2" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Chọn người xử lý</option>
              {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.username ?? "-"})</option>)}
            </select>
            <button onClick={onAssign} className="rounded bg-slate-700 px-4 py-2 text-sm font-semibold text-white">Giao xử lý</button>
          </div>

          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>
        </div>
      </div>
    </main>
  );
}
