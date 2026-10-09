"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { type Asset } from "@/lib/services";
import { errorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

const assetStatusLabel: Record<string, string> = {
  available: "Sẵn sàng",
  in_use: "Đang sử dụng",
  maintenance: "Bảo trì",
  broken: "Hỏng",
  liquidated: "Thanh lý",
};
type DepartmentOption = { id: string; name: string };
type UserOption = { id: string; full_name: string; department_id: string | null };

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loading: authLoading, user, logout, hasPermission } = useAuth();
  const { notify } = useActionFeedback();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [message, setMessage] = useState("Đang tải...");
  const [saving, setSaving] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);


  const load = async (id: string) => {
    const response = await fetch(`/api/assets/${encodeURIComponent(id)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { error?: string; asset?: Asset } | null;
    if (!response.ok) return setMessage(`❌ ${payload?.error || "Không thể tải tài sản."}`);
    setAsset(payload?.asset ?? null);
    setDepartmentId(payload?.asset?.currentAssignment?.department_id ?? "");
    setAssigneeId(payload?.asset?.currentAssignment?.assignee_id ?? "");
    setMessage("✅ Đã tải chi tiết tài sản.");
  };

  const saveAsset = async () => {
    if (!asset?.id) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset_name: asset.asset_name, category: asset.category, serial_number: asset.serial_number ?? null, status: asset.status ?? "available", note: asset.note ?? null }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Không thể cập nhật tài sản.");
      notify("success", "Đã cập nhật thông tin tài sản."); setMessage("✅ Đã cập nhật thông tin tài sản.");
    } catch (e) {
      const text = errorMessage(e, "Không thể cập nhật thông tin tài sản."); notify("error", text); setMessage(`❌ ${text}`);
    } finally {
      setSaving(false);
    }
  };

  const runLifecycle = async (action: "transfer" | "return") => {
    if (!asset?.id || lifecycleBusy) return;
    setLifecycleBusy(true);
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, asset_id: asset.id, department_id: action === "transfer" ? departmentId : null, assignee_id: action === "transfer" ? assigneeId || null : null }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; asset?: Asset } | null;
      if (!response.ok) throw new Error(payload?.error || `Không thể ${action === "return" ? "thu hồi" : "chuyển giao"} tài sản.`);
      await load(asset.id);
      notify("success", action === "return" ? "Đã thu hồi tài sản." : "Đã chuyển giao tài sản.");
      setMessage("✅ Đã cập nhật vòng đời tài sản.");
    } catch (error) {
      const text = errorMessage(error, "Không thể cập nhật vòng đời tài sản.");
      notify("error", text);
      setMessage(`❌ ${text}`);
    } finally {
      setLifecycleBusy(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!hasPermission("asset.view") && !hasPermission("asset.manage")) return void router.push("/");
    if (!params?.id) return;
    const t = setTimeout(() => {
      void load(params.id);
      if (hasPermission("asset.manage")) void fetch("/api/assets?options=1", { cache: "no-store" }).then((response) => response.json()).then((payload: { departments?: DepartmentOption[]; users?: UserOption[] }) => { setDepartments(payload.departments ?? []); setUsers(payload.users ?? []); });
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, params?.id, router, hasPermission]);

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

        <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            <Link href="/assets" className="inline-flex min-h-10 items-center rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100">← Quay lại danh sách tài sản</Link>
            <Link href="/assets/new" className="inline-flex min-h-10 items-center rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50">+ Thêm/Cấp phát tài sản</Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tên tài sản</label>
              <input className="min-h-11 w-full rounded-lg border px-3 py-2" value={asset?.asset_name ?? ""} onChange={(e) => setAsset((p) => ({ ...(p ?? { asset_name: "", category: "" }), asset_name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nhóm</label>
              <input className="min-h-11 w-full rounded-lg border px-3 py-2" value={asset?.category ?? ""} onChange={(e) => setAsset((p) => ({ ...(p ?? { asset_name: "", category: "" }), category: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Số sê-ri</label>
              <input className="min-h-11 w-full rounded-lg border px-3 py-2" value={asset?.serial_number ?? ""} onChange={(e) => setAsset((p) => ({ ...(p ?? { asset_name: "", category: "" }), serial_number: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tình trạng</label>
              <select className="min-h-11 w-full rounded-lg border px-3 py-2" value={(asset?.status === "available" ? "in_use" : (asset?.status ?? "in_use"))} onChange={(e) => setAsset((p) => ({ ...(p ?? { asset_name: "", category: "" }), status: e.target.value as Asset["status"] }))}>
                <option value="in_use">{assetStatusLabel.in_use}</option>
                <option value="maintenance">{assetStatusLabel.maintenance}</option>
                <option value="broken">{assetStatusLabel.broken}</option>
                <option value="liquidated">{assetStatusLabel.liquidated}</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ghi chú</label>
              <textarea className="min-h-28 w-full rounded-lg border px-3 py-2" value={asset?.note ?? ""} onChange={(e) => setAsset((p) => ({ ...(p ?? { asset_name: "", category: "" }), note: e.target.value || null }))} />
            </div>
          </div>

          <div className="mt-3">
            <button onClick={saveAsset} disabled={saving} className="min-h-11 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu thông tin tài sản"}</button>
          </div>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <h2 className="font-semibold">Vòng đời giao nhận</h2>
            <p className="mt-1 text-slate-600">Phòng chịu trách nhiệm và người sử dụng được quản lý qua assignment hiện tại; lịch sử transfer/return được giữ nguyên ở máy chủ.</p>
            {hasPermission("asset.manage") ? <div className="mt-3 grid gap-2 md:grid-cols-2"><select aria-label="Phòng chịu trách nhiệm" value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setAssigneeId(""); }} className="rounded border px-3 py-2"><option value="">Chọn phòng ban</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><select aria-label="Người sử dụng" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="rounded border px-3 py-2"><option value="">Tài sản chung của phòng</option>{users.filter((person) => person.department_id === departmentId).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select><div className="flex flex-wrap gap-2 md:col-span-2"><button type="button" disabled={lifecycleBusy || !departmentId} onClick={() => void runLifecycle("transfer")} className="rounded bg-sky-700 px-3 py-2 font-semibold text-white disabled:opacity-50">Transfer</button><button type="button" disabled={lifecycleBusy || !asset?.currentAssignment} onClick={() => void runLifecycle("return")} className="rounded bg-rose-700 px-3 py-2 font-semibold text-white disabled:opacity-50">Return</button></div></div> : null}
            {asset?.assignmentHistory?.length ? <ul className="mt-2 list-disc pl-5 text-slate-600">{asset.assignmentHistory.map((row) => <li key={row.id}>{row.department_id ?? "-"} / {row.assignee_id ?? "Phòng ban"} / {row.status}</li>)}</ul> : null}
          </div>
        </section>

        </div>
      </div>
    </main>
  );
}
