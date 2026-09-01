"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { assignAsset, createAsset } from "@/lib/services";
import { errorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

type StaffUser = { id: string; full_name: string; username?: string | null; active?: boolean };
type Department = { id: string; name: string; active?: boolean };
type AssetStatus = "available" | "in_use" | "maintenance" | "broken" | "liquidated";

export default function AssetCreatePage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule } = useAuth();
  const { notify } = useActionFeedback();
  const [busy, setBusy] = useState(false);

  const [assetCode, setAssetCode] = useState("");
  const [assetName, setAssetName] = useState("");
  const [category, setCategory] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [status, setStatus] = useState<AssetStatus>("in_use");
  const [note, setNote] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("assets")) return void router.push("/");

    const t = setTimeout(async () => {
      const response = await fetch("/api/assets?options=1", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { error?: string; users?: StaffUser[]; departments?: Department[] } | null;
      if (!response.ok) {
        setMessage(`⚠️ ${payload?.error || "Không thể tải danh mục."}`);
        return;
      }
      setUsers(payload?.users ?? []);
      setDepartments(payload?.departments ?? []);
    }, 0);

    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, router]);

  const onCreate = async () => {
    if (busy) return;
    setBusy(true);
    try { const result = await createAsset(
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

    if (!result.ok) throw new Error(result.error);

    const created = result.data;
    if (created?.id && (assigneeId || departmentId)) {
      const assignRes = await assignAsset(
        {
          asset_id: created.id,
          assignee_id: assigneeId || null,
          department_id: departmentId || null,
          status: "active",
        },
        user?.id,
      );
      if (!assignRes.ok) throw new Error(`Đã thêm tài sản nhưng giao chưa thành công: ${assignRes.error}`);
    }

    notify("success", "Đã thêm tài sản."); setMessage("✅ Đã thêm tài sản.");
    setAssetCode("");
    setAssetName("");
    setCategory("");
    setSerialNumber("");
    setStatus("in_use");
    setNote("");
    setAssigneeId("");
    setDepartmentId("");
    } catch (error) { const text = errorMessage(error, "Không thể thêm tài sản."); notify("error", text); setMessage(`❌ ${text}`); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/assets/new" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Thêm tài sản</h1>
          </div>

          <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold">Tạo tài sản mới</h2>
            <p className="mt-1 text-sm text-slate-500">Nhập thông tin nhận diện và tình trạng hiện tại của tài sản.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold">Mã tài sản <span className="font-normal text-slate-500">(bỏ trống để tự sinh)</span><input aria-label="Mã tài sản" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={assetCode} onChange={(e) => setAssetCode(e.target.value)} /></label>
              <label className="grid gap-1.5 text-sm font-semibold">Tên tài sản<input aria-label="Tên tài sản" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={assetName} onChange={(e) => setAssetName(e.target.value)} /></label>
              <label className="grid gap-1.5 text-sm font-semibold">Nhóm tài sản<input aria-label="Nhóm tài sản" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={category} onChange={(e) => setCategory(e.target.value)} /></label>
              <label className="grid gap-1.5 text-sm font-semibold">Số sê-ri<input aria-label="Số sê-ri" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} /></label>
              <label className="grid gap-1.5 text-sm font-semibold">Tình trạng<select aria-label="Tình trạng tài sản" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={status} onChange={(e) => setStatus(e.target.value as AssetStatus)}>
                <option value="in_use">Đang sử dụng</option>
                <option value="maintenance">Bảo trì</option>
                <option value="broken">Hỏng</option>
                <option value="liquidated">Thanh lý</option>
              </select></label>
              <label className="grid gap-1.5 text-sm font-semibold">Ghi chú<input aria-label="Ghi chú tài sản" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={note} onChange={(e) => setNote(e.target.value)} /></label>

              <label className="grid gap-1.5 text-sm font-semibold">Giao cho nhân viên<select aria-label="Giao tài sản cho nhân viên" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Giao cho ai (không bắt buộc)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}{u.username ? ` (${u.username})` : ""}</option>
                ))}
              </select></label>

              <label className="grid gap-1.5 text-sm font-semibold">Hoặc giao cho phòng ban<select aria-label="Giao tài sản cho phòng ban" className="min-h-11 rounded-lg border px-3 py-2 font-normal" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">Hoặc giao cho phòng ban (không bắt buộc)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select></label>
            </div>

            <p className="mt-4 text-sm text-slate-500">Có thể chọn giao cho nhân viên hoặc phòng ban ngay khi thêm tài sản.</p>
            <div className="mt-3">
              <button disabled={busy} onClick={onCreate} className="min-h-11 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">{busy ? "Đang thêm..." : "Thêm tài sản"}</button>
            </div>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
