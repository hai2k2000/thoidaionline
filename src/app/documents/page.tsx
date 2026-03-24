"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { assignDocument, createDocument, listDocuments, type OfficialDocument } from "@/lib/services";
import AppNav from "@/components/AppNav";

type StaffUser = { id: string; full_name: string; username?: string | null };

export default function DocumentsPage() {
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
  const [q, setQ] = useState("");

  const loadData = async () => {
    const [docsRes, usersRes] = await Promise.all([
      listDocuments(),
      supabase.from("staff_users").select("id,full_name,username").order("full_name"),
    ]);

    if (!docsRes.ok) return setMessage(`❌ ${docsRes.error}`);
    if (usersRes.error) return setMessage(`❌ ${usersRes.error.message}`);

    setRows(docsRes.data);
    setStaffUsers((usersRes.data ?? []) as StaffUser[]);
    setMessage(`✅ Đã tải ${docsRes.data.length} công văn.`);
  };

  const onCreate = async () => {
    const result = await createDocument({ doc_code: docCode, title, direction }, user?.id);
    if (!result.ok) return setMessage(`❌ ${result.error}`);
    setDocCode("");
    setTitle("");
    setMessage("✅ Đã tạo công văn.");
    await loadData();
  };

  const onAssign = async () => {
    const result = await assignDocument(documentId, assigneeId, user?.id);
    if (!result.ok) return setMessage(`❌ ${result.error}`);
    setMessage("✅ Đã giao xử lý công văn.");
    await loadData();
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("documents")) return void router.push("/");
    const t = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, router]);

  const filteredRows = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = `${r.doc_code ?? ""} ${r.title ?? ""} ${r.direction ?? ""} ${r.status ?? ""}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Quản lý công văn</h1>
          <div className="mt-2">
            <AppNav currentPath="/documents" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Tạo công văn</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <input className="rounded border px-3 py-2" placeholder="Mã công văn (bỏ trống để tự sinh)" value={docCode} onChange={(e) => setDocCode(e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select className="rounded border px-3 py-2" value={direction} onChange={(e) => setDirection(e.target.value as "incoming" | "outgoing")}>
              <option value="incoming">Công văn đến</option>
              <option value="outgoing">Công văn đi</option>
            </select>
            <button onClick={onCreate} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white">Tạo</button>
          </div>

          <h3 className="mt-4 mb-2 text-sm font-semibold">Giao xử lý</h3>
          <div className="grid gap-2 md:grid-cols-3">
            <select className="rounded border px-3 py-2" value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
              <option value="">Chọn công văn</option>
              {rows.map((d) => <option key={d.id} value={d.id}>{d.doc_code} - {d.title}</option>)}
            </select>
            <select className="rounded border px-3 py-2" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Chọn người xử lý</option>
              {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.username ?? "-"})</option>)}
            </select>
            <button onClick={onAssign} className="rounded bg-slate-700 px-4 py-2 text-sm font-semibold text-white">Giao việc</button>
          </div>

          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4 overflow-auto">
          <div className="mb-3">
            <input className="w-full rounded border px-3 py-2 md:w-96" placeholder="Tìm theo mã/tiêu đề/trạng thái" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <table className="table-soft-red min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2">Mã</th>
                <th className="px-2 py-2">Loại</th>
                <th className="px-2 py-2">Tiêu đề</th>
                <th className="px-2 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id ?? r.doc_code} className="cursor-pointer" onClick={() => r.id && router.push(`/documents/${r.id}`)}>
                  <td className="px-2 py-2">{r.doc_code}</td>
                  <td className="px-2 py-2">{r.direction === "incoming" ? "Đến" : "Đi"}</td>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center rounded border border-blue-200 bg-gradient-to-r from-sky-50 to-blue-100 px-2 py-1 font-semibold text-blue-800">{r.title}</span>
                  </td>
                  <td className="px-2 py-2">{r.status ?? "new"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
