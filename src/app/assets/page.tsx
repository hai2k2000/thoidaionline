"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { listAssets, type Asset } from "@/lib/services";
import AppNav from "@/components/AppNav";

type StaffUser = { id: string; full_name: string };
type Department = { id: string; name: string };
type Assignment = { asset_id: string; assignee_id?: string | null; department_id?: string | null; status?: string | null; returned_at?: string | null };

type AssetRow = Asset & { assigned_to_label?: string };

const assetStatusLabel: Record<string, string> = {
  available: "Sẵn sàng",
  in_use: "Đang sử dụng",
  maintenance: "Bảo trì",
  broken: "Hỏng",
  liquidated: "Thanh lý",
};

export default function AssetsPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule, hasPermission } = useAuth();

  const [rows, setRows] = useState<AssetRow[]>([]);
  const [message, setMessage] = useState("Đang tải...");
  const [qName, setQName] = useState("");
  const [qCategory, setQCategory] = useState("");
  const [qStatus, setQStatus] = useState("");

  const loadData = async () => {
    const [assetsRes, assignRes, usersRes, depRes] = await Promise.all([
      listAssets(),
      supabase.from("asset_assignments").select("asset_id,assignee_id,department_id,status,returned_at"),
      supabase.from("staff_users").select("id,full_name"),
      supabase.from("departments").select("id,name"),
    ]);

    if (!assetsRes.ok) return setMessage(`❌ ${assetsRes.error}`);
    if (assignRes.error || usersRes.error || depRes.error) {
      return setMessage(`❌ ${assignRes.error?.message || usersRes.error?.message || depRes.error?.message}`);
    }

    const users = (usersRes.data ?? []) as StaffUser[];
    const deps = (depRes.data ?? []) as Department[];
    const assignments = ((assignRes.data ?? []) as Assignment[]).filter((a) => a.status === "active" && !a.returned_at);

    const userMap = new Map(users.map((u) => [u.id, u.full_name]));
    const depMap = new Map(deps.map((d) => [d.id, d.name]));

    const assignedMap = new Map<string, string>();
    assignments.forEach((a) => {
      const userName = a.assignee_id ? userMap.get(a.assignee_id) : null;
      const depName = a.department_id ? depMap.get(a.department_id) : null;
      assignedMap.set(a.asset_id, userName || (depName ? `Phòng ban: ${depName}` : "-"));
    });

    const mapped = assetsRes.data.map((a) => ({ ...a, assigned_to_label: assignedMap.get(a.id ?? "") ?? "-" }));

    const visible = hasPermission("can_edit_all_tasks")
      ? mapped
      : mapped.filter((a) => assignments.some((x) => x.asset_id === a.id && x.assignee_id === user?.id));
    setRows(visible);
    setMessage(`✅ Đã tải ${visible.length} tài sản.`);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("assets")) return void router.push("/");
    const t = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, router, hasPermission]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const okName = !qName.trim() || (r.asset_name ?? "").toLowerCase().includes(qName.toLowerCase());
      const okCategory = !qCategory.trim() || (r.category ?? "").toLowerCase().includes(qCategory.toLowerCase());
      const okStatus = !qStatus || (r.status ?? "") === qStatus;
      return okName && okCategory && okStatus;
    });
  }, [rows, qName, qCategory, qStatus]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Quản lý tài sản</h1>
          <div className="mt-2">
            <AppNav currentPath="/assets" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Lọc tài sản</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <input className="rounded border px-3 py-2" placeholder="Lọc theo tên tài sản" value={qName} onChange={(e) => setQName(e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Lọc theo nhóm" value={qCategory} onChange={(e) => setQCategory(e.target.value)} />
            <select className="rounded border px-3 py-2" value={qStatus} onChange={(e) => setQStatus(e.target.value)}>
              <option value="">Tất cả tình trạng</option>
              <option value="available">{assetStatusLabel.available}</option>
              <option value="in_use">{assetStatusLabel.in_use}</option>
              <option value="maintenance">{assetStatusLabel.maintenance}</option>
              <option value="broken">{assetStatusLabel.broken}</option>
              <option value="liquidated">{assetStatusLabel.liquidated}</option>
            </select>
            <button onClick={() => { setQName(""); setQCategory(""); setQStatus(""); }} className="rounded bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800">
              Xóa lọc
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4 overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2">Tên</th>
                <th className="px-2 py-2">Nhóm</th>
                <th className="px-2 py-2">Đã cấp phát cho ai</th>
                <th className="px-2 py-2">Tình trạng</th>
                <th className="px-2 py-2">Ghi chú</th>
                <th className="px-2 py-2">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id ?? r.asset_code} className="cursor-pointer" onClick={() => router.push(`/assets/${r.id}`)}>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center rounded border border-rose-200 bg-gradient-to-r from-rose-50 to-red-100 px-2 py-1 font-semibold text-rose-800">{r.asset_name}</span>
                  </td>
                  <td className="px-2 py-2">{r.category}</td>
                  <td className="px-2 py-2">{r.assigned_to_label ?? "-"}</td>
                  <td className="px-2 py-2">{assetStatusLabel[r.status ?? "available"] ?? (r.status ?? "-")}</td>
                  <td className="px-2 py-2">{r.note ?? "-"}</td>
                  <td className="px-2 py-2">
                    <Link href={`/assets/${r.id}`} className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-300" onClick={(e) => e.stopPropagation()}>
                      Xem chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
