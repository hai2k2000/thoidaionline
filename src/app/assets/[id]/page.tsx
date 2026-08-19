"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { type Asset } from "@/lib/services";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

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
  const { loading: authLoading, user, logout, canAccessModule, hasPermission } = useAuth();
  const { notify } = useActionFeedback();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [message, setMessage] = useState("Đang tải...");
  const [saving, setSaving] = useState(false);


  const load = async (id: string) => {
    const { data, error } = await supabase.from("assets").select("*").eq("id", id).single();

    if (error) return setMessage(`❌ ${error.message}`);

    if (!hasPermission("can_edit_all_tasks") && user?.id) {
      const { data: assignData, error: assignErr } = await supabase
        .from("asset_assignments")
        .select("id")
        .eq("asset_id", id)
        .eq("assignee_id", user.id)
        .eq("status", "active")
        .is("returned_at", null)
        .limit(1)
        .maybeSingle();

      if (assignErr || !assignData) {
        setMessage("❌ Bạn không có quyền xem chi tiết tài sản này.");
        return void router.push("/assets");
      }
    }

    setAsset((data ?? null) as Asset | null);
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
      notify("success", "Đã cập nhật thông tin tài sản."); setMessage("✅ Đã cập nhật thông tin tài sản.");
    } catch (e) {
      const text = errorMessage(e, "Không thể cập nhật thông tin tài sản."); notify("error", text); setMessage(`❌ ${text}`);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("assets")) return void router.push("/");
    if (!params?.id) return;
    const t = setTimeout(() => void load(params.id), 0);
    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, params?.id, router, hasPermission]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/assets" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Chi tiết tài sản</h1>
          </div>

        <p className="mb-3 text-sm text-slate-600">{message}</p>

        <section className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <Link href="/assets" className="inline-flex items-center rounded border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100 px-2 py-1 text-sm font-semibold text-orange-800 hover:from-orange-100 hover:to-amber-200">← Quay lại danh sách tài sản</Link>
            <Link href="/assets/new" className="inline-flex items-center rounded border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100 px-2 py-1 text-sm font-semibold text-orange-800 hover:from-orange-100 hover:to-amber-200">+ Thêm/Cấp phát tài sản</Link>
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
              <select className="w-full rounded border px-3 py-2" value={(asset?.status === "available" ? "in_use" : (asset?.status ?? "in_use"))} onChange={(e) => setAsset((p) => ({ ...(p ?? { asset_name: "", category: "" }), status: e.target.value as Asset["status"] }))}>
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
            <button onClick={saveAsset} disabled={saving} className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu thông tin tài sản"}</button>
          </div>
        </section>

        </div>
      </div>
    </main>
  );
}
