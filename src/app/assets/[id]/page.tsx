"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { type Asset, type AssetAssignment } from "@/lib/services";
import { errorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

const assetStatusLabel: Record<string, string> = { available: "Chưa phân công / Sẵn sàng", in_use: "Đang sử dụng", maintenance: "Bảo trì", broken: "Hỏng", liquidated: "Thanh lý" };
const trackingModeLabel: Record<string, string> = { individual: "Cá thể", lot: "Theo lô" };
const assignmentStatusLabel: Record<string, string> = { active: "Đang sử dụng", returned: "Đã thu hồi", lost: "Mất", damaged: "Hư hỏng" };
type DepartmentOption = { id: string; name: string };
type UserOption = { id: string; full_name: string; department_id: string | null };

const formatDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
function assignmentDepartment(assignment: AssetAssignment, asset: Asset) { return assignment.assigned_department_name ?? (assignment.id === asset.currentAssignment?.id ? asset.assigned_department_name : null) ?? "Phòng đã phân công"; }
function assignmentPerson(assignment: AssetAssignment, asset: Asset) { return assignment.assignee_name ?? (assignment.id === asset.currentAssignment?.id ? asset.assignee_name : null) ?? "Tài sản dùng chung của phòng"; }
function historyOperation(row: AssetAssignment, index: number) { if (row.status === "returned") return row.return_note === "Transferred by asset lifecycle." ? "Chuyển giao" : "Thu hồi"; return index === 0 ? "Cấp phát" : "Chuyển giao"; }
function historyState(row: AssetAssignment) { if (row.return_note === "Transferred by asset lifecycle.") return "Đã chuyển"; return assignmentStatusLabel[row.status ?? ""] ?? "Đã cập nhật"; }

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loading: authLoading, user, logout, hasPermission } = useAuth();
  const { notify } = useActionFeedback();
  const canManage = hasPermission("asset.manage");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [message, setMessage] = useState("Đang tải...");
  const [saving, setSaving] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
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
    if (!asset?.id || !canManage) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset_name: asset.asset_name, category: asset.category, serial_number: asset.serial_number ?? null, status: asset.status ?? "available", note: asset.note ?? null }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Không thể cập nhật tài sản.");
      notify("success", "Đã cập nhật thông tin tài sản."); setMessage("✅ Đã cập nhật thông tin tài sản.");
    } catch (error) { const text = errorMessage(error, "Không thể cập nhật thông tin tài sản."); notify("error", text); setMessage(`❌ ${text}`); }
    finally { setSaving(false); }
  };

  const runLifecycle = async (action: "transfer" | "return") => {
    if (!asset?.id || lifecycleBusy || !canManage) return;
    if (action === "transfer" && !window.confirm("Chuyển giao tài sản sang phòng/người sử dụng mới?")) return;
    if (action === "return" && !window.confirm("Thu hồi tài sản khỏi người/phòng đang sử dụng?\n\nSau khi thu hồi, tài sản sẽ trở về trạng thái chưa phân công.")) return;
    setLifecycleBusy(true);
    try {
      const response = await fetch("/api/assets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, asset_id: asset.id, department_id: action === "transfer" ? departmentId : null, assignee_id: action === "transfer" ? assigneeId || null : null }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || `Không thể ${action === "return" ? "thu hồi" : "chuyển giao"} tài sản.`);
      await load(asset.id); setTransferOpen(false); notify("success", action === "return" ? "Đã thu hồi tài sản." : "Đã chuyển giao tài sản."); setMessage("✅ Đã cập nhật thông tin sử dụng tài sản.");
    } catch (error) { const text = errorMessage(error, "Không thể cập nhật thông tin sử dụng tài sản."); notify("error", text); setMessage(`❌ ${text}`); }
    finally { setLifecycleBusy(false); }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!hasPermission("asset.view") && !canManage) return void router.push("/");
    if (!params?.id) return;
    const timer = setTimeout(() => { void load(params.id); if (canManage) void fetch("/api/assets?options=1", { cache: "no-store" }).then((response) => response.json()).then((payload: { departments?: DepartmentOption[]; users?: UserOption[] }) => { setDepartments(payload.departments ?? []); setUsers(payload.users ?? []); }); }, 0);
    return () => clearTimeout(timer);
  }, [authLoading, user, params?.id, router, hasPermission, canManage]);

  const currentAssignment = asset?.currentAssignment ?? null;
  const currentDepartment = currentAssignment ? assignmentDepartment(currentAssignment, asset as Asset) : "Chưa phân công";
  const currentPerson = currentAssignment ? assignmentPerson(currentAssignment, asset as Asset) : "—";
  const history = useMemo(() => [...(asset?.assignmentHistory ?? [])].sort((a, b) => new Date(a.assigned_at ?? "").getTime() - new Date(b.assigned_at ?? "").getTime()), [asset?.assignmentHistory]);
  const setAssetField = (patch: Partial<Asset>) => setAsset((current) => current ? { ...current, ...patch } : current);

  return (
    <main className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4"><div className="mb-4 lg:mb-0"><AppNav currentPath="/assets" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} /></div>
      <div className="min-w-0"><header className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">Quản lý tài sản</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Chi tiết tài sản</h1></div><Link href="/assets" className="inline-flex min-h-10 items-center rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100">← Quay lại danh sách tài sản</Link></header>
        <p role={message.startsWith("❌") ? "alert" : "status"} className="mb-3 text-sm text-slate-600">{message}</p>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="border-b border-slate-100 pb-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Thông tin tài sản</p><p className="mt-1 text-sm text-slate-600">Thông tin nhận diện, tình trạng và ghi chú của tài sản.</p></div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Tên tài sản<input readOnly={!canManage} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 font-normal read-only:bg-slate-50" value={asset?.asset_name ?? ""} onChange={(event) => setAssetField({ asset_name: event.target.value })} /></label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Mã tài sản<input readOnly className="min-h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-normal" value={asset?.asset_code ?? "—"} /></label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Nhóm<input readOnly={!canManage} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 font-normal read-only:bg-slate-50" value={asset?.category ?? ""} onChange={(event) => setAssetField({ category: event.target.value })} /></label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Số sê-ri<input readOnly={!canManage} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 font-normal read-only:bg-slate-50" value={asset?.serial_number ?? ""} onChange={(event) => setAssetField({ serial_number: event.target.value || null })} /></label>
            <div className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Kiểu theo dõi</span><p className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal">{trackingModeLabel[asset?.tracking_mode ?? "individual"] ?? "—"}</p></div>
            <div className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Số lượng</span><p className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal tabular-nums">{asset?.quantity ?? 1}</p></div>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Tình trạng<select disabled={!canManage} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal disabled:bg-slate-50" value={asset?.status ?? "available"} onChange={(event) => setAssetField({ status: event.target.value as Asset["status"] })}>{Object.entries(assetStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Phòng đang quản lý<input readOnly className="min-h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-normal" value={currentDepartment} /></label>
            <div className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Người đang sử dụng</span><p className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal">{currentPerson}</p></div>
            <div className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Ngày cấp phát</span><p className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal">{formatDateTime(currentAssignment?.assigned_at)}</p></div>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700 md:col-span-2">Ghi chú<textarea readOnly={!canManage} className="min-h-28 rounded-lg border border-slate-300 px-3 py-2 font-normal read-only:bg-slate-50" value={asset?.note ?? ""} onChange={(event) => setAssetField({ note: event.target.value || null })} /></label>
          </div>
          {canManage ? <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={saveAsset} disabled={saving} className="min-h-11 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu thông tin"}</button><button type="button" onClick={() => { setTransferOpen((open) => !open); setDepartmentId(currentAssignment?.department_id ?? ""); setAssigneeId(currentAssignment?.assignee_id ?? ""); }} className="min-h-11 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100">Chuyển giao</button><button type="button" onClick={() => void runLifecycle("return")} disabled={lifecycleBusy || !currentAssignment} className="min-h-11 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50">Thu hồi</button></div> : null}
          {canManage && transferOpen ? <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-sky-950">Chuyển giao tài sản</h2><p className="mt-1 text-sm text-sky-800">Chọn phòng mới và người sử dụng mới. Để trống người sử dụng nếu tài sản dùng chung của phòng.</p></div><button type="button" onClick={() => setTransferOpen(false)} className="text-sm font-semibold text-sky-800 underline">Đóng</button></div><div className="mt-3 grid gap-3 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Phòng mới<select aria-label="Phòng mới" value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setAssigneeId(""); }} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option value="">Chọn phòng ban</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Người sử dụng mới<select aria-label="Người sử dụng mới" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option value="">Tài sản dùng chung của phòng</option>{users.filter((person) => person.department_id === departmentId).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label></div><button type="button" disabled={lifecycleBusy || !departmentId} onClick={() => void runLifecycle("transfer")} className="mt-3 min-h-11 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50">Xác nhận chuyển giao</button></div> : null}
        </section>
        {history.length ? <details className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm"><summary className="cursor-pointer list-none px-4 py-4 text-sm font-bold text-slate-800 sm:px-5">Xem lịch sử giao nhận</summary><div className="border-t border-slate-100 p-4 sm:p-5"><p className="mb-3 text-sm text-slate-600">Lịch sử chỉ hiển thị các lần cấp phát, chuyển giao và thu hồi của tài sản này.</p><div className="hidden overflow-x-auto md:block"><table className="data-table min-w-[720px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2">Ngày</th><th className="px-3 py-2">Thao tác</th><th className="px-3 py-2">Phòng</th><th className="px-3 py-2">Người sử dụng</th><th className="px-3 py-2">Trạng thái</th></tr></thead><tbody>{history.map((row, index) => <tr key={row.id} className="border-t border-slate-100"><td className="whitespace-nowrap px-3 py-3">{formatDateTime(row.returned_at ?? row.assigned_at)}</td><td className="px-3 py-3 font-semibold">{historyOperation(row, index)}</td><td className="px-3 py-3">{row.department_id ? assignmentDepartment(row, asset as Asset) : "—"}</td><td className="px-3 py-3">{row.assignee_id ? assignmentPerson(row, asset as Asset) : row.department_id ? "Tài sản dùng chung của phòng" : "—"}</td><td className="px-3 py-3">{historyState(row)}</td></tr>)}</tbody></table></div><div className="grid gap-3 md:hidden">{history.map((row, index) => <article key={row.id} className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{formatDateTime(row.returned_at ?? row.assigned_at)}</p><p className="mt-1 font-bold text-slate-900">{historyOperation(row, index)}</p><dl className="mt-2 grid gap-1 text-sm"><div><dt className="inline text-slate-500">Phòng: </dt><dd className="inline font-medium">{row.department_id ? assignmentDepartment(row, asset as Asset) : "—"}</dd></div><div><dt className="inline text-slate-500">Người sử dụng: </dt><dd className="inline font-medium">{row.assignee_id ? assignmentPerson(row, asset as Asset) : row.department_id ? "Tài sản dùng chung của phòng" : "—"}</dd></div><div><dt className="inline text-slate-500">Trạng thái: </dt><dd className="inline font-medium">{historyState(row)}</dd></div></dl></article>)}</div></div></details> : null}
      </div>
    </div></main>
  );
}
