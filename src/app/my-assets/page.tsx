"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { listMyAssets, listMyAssetStatusRequests, createAssetStatusRequest, type Asset, type AssetStatusChangeRequest } from "@/lib/services";

export default function MyAssetsPage() {
  const router = useRouter();
  const { loading, user, logout, hasPermission } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<AssetStatusChangeRequest[]>([]);
  const [message, setMessage] = useState("Đang tải...");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [status, setStatus] = useState<"maintenance" | "broken">("maintenance");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const [assetResult, requestResult] = await Promise.all([listMyAssets(), listMyAssetStatusRequests()]);
    if (!assetResult.ok) return setMessage(assetResult.error);
    setAssets(assetResult.data);
    if (requestResult.ok) setRequests(requestResult.data.requests ?? []);
    setMessage("");
  }, []);
  useEffect(() => {
    if (loading) return;
    if (!user) return void router.push("/login");
    if (!hasPermission("asset.view") && !hasPermission("asset.manage")) return void router.push("/");
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [loading, user, router, hasPermission, load]);

  const submit = async () => {
    if (!selected) return;
    const result = await createAssetStatusRequest(selected.id ?? "", status, reason);
    if (!result.ok) return setMessage(result.error);
    setSelected(null); setReason(""); setMessage("Đã gửi đề xuất; chờ người quản lý tài sản duyệt."); void load();
  };

  return <main className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4"><div className="mb-4 lg:mb-0"><AppNav currentPath="/my-assets" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} /></div><div className="min-w-0"><header className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">Tài sản cá nhân</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Tài sản của tôi</h1><p className="mt-1 text-sm text-slate-600">Chỉ hiển thị tài sản đang được giao trực tiếp cho tài khoản hiện tại.</p></header>{message ? <p className="mb-3 text-sm text-slate-600">{message}</p> : null}<section className="grid gap-3 md:grid-cols-2">{assets.map((asset) => <article key={asset.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{asset.asset_name}</h2><p className="mt-1 text-xs text-slate-500">{asset.asset_code ?? "Không có mã"} · {asset.category}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{asset.status}</span></div><p className="mt-3 text-sm text-slate-600">{asset.note || "Không có ghi chú"}</p><button type="button" onClick={() => setSelected(asset)} className="mt-4 min-h-10 rounded-lg border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-800">Đề xuất đổi tình trạng</button></article>)}{assets.length === 0 && !message ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-sm text-slate-500">Chưa có tài sản được giao trực tiếp.</p> : null}</section><section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold">Đề xuất của tôi</h2><div className="mt-3 divide-y divide-slate-100">{requests.map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{request.requested_status} · {request.reason}</span><span className="font-semibold text-slate-600">{request.status}</span></div>)}{requests.length === 0 ? <p className="py-3 text-sm text-slate-500">Chưa có đề xuất.</p> : null}</div></section></div></div>{selected ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h2 className="text-lg font-bold">Đề xuất đổi tình trạng</h2><p className="mt-1 text-sm text-slate-600">{selected.asset_name}</p><label className="mt-4 grid gap-1 text-sm font-semibold">Tình trạng đề xuất<select className="min-h-11 rounded-lg border px-3 font-normal" value={status} onChange={(e) => setStatus(e.target.value as "maintenance" | "broken")}><option value="maintenance">Bảo trì</option><option value="broken">Hỏng</option></select></label><label className="mt-3 grid gap-1 text-sm font-semibold">Lý do<textarea className="rounded-lg border p-3 font-normal" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} /></label><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setSelected(null)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Hủy</button><button type="button" disabled={reason.trim().length < 3} onClick={() => void submit()} className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Gửi đề xuất</button></div></div></div> : null}</main>;
}
