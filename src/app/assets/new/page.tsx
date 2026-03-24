"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { createAsset } from "@/lib/services";

export default function AssetCreatePage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule } = useAuth();

  const [assetCode, setAssetCode] = useState("");
  const [assetName, setAssetName] = useState("");
  const [category, setCategory] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [status, setStatus] = useState<"available" | "in_use" | "maintenance" | "broken" | "liquidated">("available");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("assets")) return void router.push("/");
  }, [authLoading, user, canAccessModule, router]);

  const onCreate = async () => {
    const result = await createAsset(
      {
        asset_code: assetCode || undefined,
        asset_name: assetName,
        category,
        serial_number: serialNumber || undefined,
        status,
        note: note || undefined,
      },
      user?.id,
    );

    if (!result.ok) return setMessage(`❌ ${result.error}`);
    setMessage("✅ Đã thêm tài sản.");
    setAssetCode("");
    setAssetName("");
    setCategory("");
    setSerialNumber("");
    setStatus("available");
    setNote("");
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Thêm tài sản</h1>
          <div className="mt-2">
            <AppNav currentPath="/assets/new" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Tạo tài sản mới</h2>
          <div className="grid gap-2 md:grid-cols-2">
            <input className="rounded border px-3 py-2" placeholder="Mã tài sản (bỏ trống để tự sinh)" value={assetCode} onChange={(e) => setAssetCode(e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Tên tài sản" value={assetName} onChange={(e) => setAssetName(e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Nhóm tài sản" value={category} onChange={(e) => setCategory(e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Số serial" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
            <select className="rounded border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="available">Sẵn sàng</option>
              <option value="in_use">Đang sử dụng</option>
              <option value="maintenance">Bảo trì</option>
              <option value="broken">Hỏng</option>
              <option value="liquidated">Thanh lý</option>
            </select>
            <input className="rounded border px-3 py-2" placeholder="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="mt-3">
            <button onClick={onCreate} className="rounded bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Thêm tài sản</button>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>
      </div>
    </main>
  );
}
