"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { listDocuments, type OfficialDocument } from "@/lib/services";

const docStatusLabel: Record<string, string> = {
  new: "Mới",
  in_progress: "Đang xử lý",
  done: "Hoàn thành",
  archived: "Lưu trữ",
};

export default function CommonDocumentsPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule } = useAuth();

  const [rows, setRows] = useState<OfficialDocument[]>([]);
  const [message, setMessage] = useState("Đang tải...");
  const [q, setQ] = useState("");

  const loadData = async () => {
    const docsRes = await listDocuments();
    if (!docsRes.ok) return setMessage(`❌ ${docsRes.error}`);
    const commons = docsRes.data.filter((d) => d.direction === "common");
    setRows(commons);
    setMessage(`✅ Đã tải ${commons.length} tài liệu chung.`);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("documents")) return void router.push("/");
    const t = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(t);
  }, [authLoading, user, router, canAccessModule]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (!q.trim()) return true;
      const s = `${r.doc_code ?? ""} ${r.title ?? ""} ${r.direction ?? ""} ${r.status ?? ""}`.toLowerCase();
      return s.includes(q.toLowerCase());
    });
  }, [rows, q]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/documents/common" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Tài liệu chung</h1>
          </div>

        <section className="rounded-xl border bg-white p-4 overflow-auto">
          <div className="mb-3">
            <input className="w-full rounded border px-3 py-2 md:w-96" placeholder="Tìm theo mã/tiêu đề/trạng thái" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <p className="mb-2 text-sm text-slate-600">{message}</p>

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
                  <td className="px-2 py-2">Tài liệu chung</td>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center rounded border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100 px-2 py-1 font-semibold text-orange-800">{r.title}</span>
                  </td>
                  <td className="px-2 py-2">{docStatusLabel[r.status ?? "new"] ?? (r.status ?? "Mới")}</td>
                </tr>
              ))}
              {filteredRows.length === 0 ? <tr><td colSpan={4} className="px-2 py-6 text-center text-slate-500">Chưa có tài liệu.</td></tr> : null}
            </tbody>
          </table>
        </section>
        </div>
      </div>
    </main>
  );
}
