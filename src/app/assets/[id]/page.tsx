"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { assignAsset, type Asset } from "@/lib/services";
import { supabase } from "@/lib/supabase";

type StaffUser = { id: string; full_name: string };
type Department = { id: string; name: string };

const assetStatusLabel: Record<string, string> = {
  available: "Sẵn sàng",
  in_use: "Đang sử dụng",
  maintenance: "Bảo trì",
  broken: "Hỏng",
  liquidated: "Thanh lý",
};

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule } = useAuth();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [message, setMessage] = useState("Đang tải...");
  const [saving, setSaving] = useState(false);

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const load = async (id: string) => {
    const [assetRes, usersRes, depRes] = await Promise.all([
      supabase.from("assets").select("*").eq("id", id).single(),
      supabase.from("staff_users").select("id,full_name").order("full_name"),
      supabase.from("departments").select("id,name").order("name"),
    ]);

    if (assetRes.error) return setMessage(`❌ ${assetRes.error.message}`);
    if (usersRes.error || depRes.error) return setMessage(`❌ ${usersRes.error?.message || depRes.error?.message}`);

    setAsset((assetRes.data ?? null) as Asset | null);
    setUsers((usersRes.data ?? []) as StaffUser[]);
    setDepartments((depRes.data ?? []) as Department[]);
    setMessage("✅ Đã tải chi tiết tài sản.");
  };

  const saveAsset = async () => {
    if (!asset?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("assets")
        .update({
          asset_name: asset.asset_name,
          category: asset.category,
          serial_number: asset.serial_number ?? null,
          status: asset.status ?? "available",
          note: asset.note ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", asset.id);

      if (error) throw error;
      setMessage("✅ Đã cập nhật thông tin tài sản.");
    } catch (e) {
      setMessage(`❌ ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const assign = async () => {
    if (!asset?.id) return;
    const r = await assignAsset({ asset_id: asset.id, assignee_id: assigneeId || null, department_id: departmentId || null }, user?.id);
    if (!r.ok) return setMessage(`❌ ${r.error}`);
    setMessage("✅ Đã cấp phát tài sản.");
    setAssigneeId("");
    setDepartmentId("");
    await load(asset.id);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("assets")) return void router.push("/");
    if (!params?.id) return;
    const t = setTimeout(() => void load(params.id), 0);
    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, params?.id, router]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Chi tiết tài sản</h1>
          <div className="mt-2">
            <AppNav currentPath="/assets" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>

        <p className="mb-3 text-sm text-slate-600">{message}</p>

        <section className="rounded-xl border bg-white p-4">
          <div className="mb-3">
            <Link href="/assets" className="inline-flex items-center rounded border border-rose-200 bg-gradient-to-r from-rose-50 to-red-100 px-2 py-1 text-sm font-semibold text-rose-800 hover:from-rose-100 hover:to-red-200">← Quay lại danh sách tài sản</Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Tên tài sản</label>
              <input className="w-full rounded border px-3 py-2" value={asset?.asset_name ?? ""} onChange={(e) => setAsset((p) => ({ ...(p ?? { asset_name: "", category: "" }), asset_name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nhóm</label>
              <input className="w-full rounded border px-3 py-2" value={asset?.category ?? ""} onChange={(e) => setAsset((p) => ({ ...(p ?? { asset_name: "", category: "" }), category: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Serial</label>
              <input className="w-full rounded border px-3 py-2" value={asset?.serial_number ?? ""} onChange={(e) => setAsset((p) => ({ ...(p ?? { asset_name: "", category: "" }), serial_number: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Tình trạng</label>
              <select className="w-full rounded border px-3 py-2" value={asset?.status ?? "available"} onChange={(e) => setAsset((p) => ({ ...(p ?? { asset_name: "", category: "" }), status: e.target.value as Asset["status"] }))}>
                <option value="available">{assetStatusLabel.available}</option>
                <option value="in_use">{assetStatusLabel.in_use}</option>
                <option value="maintenance">{assetStatusLabel.maintenance}</option>
                <option value="broken">{assetStatusLabel.broken}</option>
                <option value="liquidated">{assetStatusLabel.liquidated}</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Ghi chú</label>
              <textarea className="min-h-24 w-full rounded border px-3 py-2" value={asset?.note ?? ""} onChange={(e) => setAsset((p) => ({ ...(p ?? { asset_name: "", category: "" }), note: e.target.value || null }))} />
            </div>
          </div>

          <div className="mt-3">
            <button onClick={saveAsset} disabled={saving} className="rounded bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu thông tin tài sản"}</button>
          </div>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Cấp phát tài sản</h2>
          <div className="grid gap-2 md:grid-cols-3">
            <select className="rounded border px-3 py-2" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Chọn nhân sự nhận (optional)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
            <select className="rounded border px-3 py-2" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Chọn phòng ban nhận (optional)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button onClick={assign} className="rounded bg-slate-700 px-4 py-2 text-sm font-semibold text-white">Cấp phát</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Có thể cấp phát cho nhân sự hoặc phòng ban (ít nhất chọn 1).</p>
        </section>
      </div>
    </main>
  );
}
