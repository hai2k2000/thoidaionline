"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { listAssets, type Asset } from "@/lib/services";
import AppNav from "@/components/AppNav";

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
    const assetsRes = await listAssets();

    if (!assetsRes.ok) return setMessage(`❌ ${assetsRes.error}`);
    setRows(assetsRes.data as AssetRow[]);
    setMessage(`✅ Đã tải ${assetsRes.data.length} tài sản.`);
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
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/assets" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Danh sách tài sản</h1>
          </div>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Lọc tài sản</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <input className="rounded border px-3 py-2" placeholder="Lọc theo tên tài sản" value={qName} onChange={(e) => setQName(e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Lọc theo nhóm" value={qCategory} onChange={(e) => setQCategory(e.target.value)} />
            <select className="rounded border px-3 py-2" value={qStatus} onChange={(e) => setQStatus(e.target.value)}>
              <option value="">Tất cả tình trạng</option>
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

        <section className="mt-4 rounded-xl border bg-white p-4">
          <div className="table-scroll rounded-lg border border-slate-200" tabIndex={0} aria-label="Danh sách tài sản, cuộn ngang để xem thêm">
          <table className="data-table min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-3 py-2">Tên</th>
                <th scope="col" className="px-3 py-2">Nhóm</th>
                <th scope="col" className="px-3 py-2">Đã cấp phát cho ai</th>
                <th scope="col" className="px-3 py-2">Tình trạng</th>
                <th scope="col" className="min-w-64 px-3 py-2">Ghi chú</th>
                <th scope="col" className="px-3 py-2">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id ?? r.asset_code} className="cursor-pointer" onClick={() => router.push(`/assets/${r.id}`)}>
                  <td className="min-w-56 px-3 py-2">
                    <span className="inline-flex items-center rounded border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100 px-2 py-1 font-semibold text-orange-800">{r.asset_name}</span>
                  </td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2">{r.assigned_to_label ?? "-"}</td>
                  <td className="px-3 py-2"><span className={`table-status ${r.status === "available" ? "table-status-success" : r.status === "broken" ? "table-status-danger" : r.status === "maintenance" ? "table-status-warning" : "table-status-neutral"}`}>{assetStatusLabel[r.status ?? "available"] ?? (r.status ?? "-")}</span></td>
                  <td className="min-w-64 px-3 py-2">{r.note ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link href={`/assets/${r.id}`} className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-300" onClick={(e) => e.stopPropagation()}>
                      Xem chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
