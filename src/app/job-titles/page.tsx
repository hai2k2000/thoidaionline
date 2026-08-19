"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

type JobTitle = { id: string; code: string; name: string; display_order: number; active: boolean };
type Form = { id?: string; code: string; name: string; display_order: string; active: boolean };
type JobTitleStatusFilter = "active" | "locked" | "all";
const canonicalCodes = new Set(["tong_bien_tap","pho_tong_bien_tap","truong_phong","pho_truong_phong","ke_toan_truong","phong_vien","nhan_vien"]);
const blank: Form = { code: "", name: "", display_order: "100", active: true };

export default function JobTitlesPage() {
  const router = useRouter();
  const { loading, user, logout } = useAuth();
  const { notify } = useActionFeedback();
  const [rows, setRows] = useState<JobTitle[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [message, setMessage] = useState("Đang tải...");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<JobTitleStatusFilter>("active");
  const visibleRows = rows.filter((row) => statusFilter === "all" || row.active === (statusFilter === "active"));

  const load = async () => {
    const response = await fetch("/api/job-titles", { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { error?: string; job_titles?: JobTitle[] } | null;
    if (!response.ok) return setMessage(`❌ ${payload?.error || "Không thể tải danh mục."}`);
    setRows(payload?.job_titles ?? []);
    setMessage(`✅ Đã tải ${payload?.job_titles?.length ?? 0} chức vụ.`);
  };

  useEffect(() => {
    if (loading) return;
    if (!user) return void router.push("/login");
    if (user.role_code !== "admin") return void router.push("/");
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [loading, user, router]);

  const save = async () => {
    if (!user || user.role_code !== "admin" || saving) return;
    setSaving(true);
    try { const response = await fetch("/api/job-titles", {
      method: form.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, display_order: Number(form.display_order) }),
    });
    if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể lưu chức vụ."));
    setForm(blank);
    await load();
    notify("success", form.id ? "Đã cập nhật chức vụ." : "Đã thêm chức vụ."); setMessage(form.id ? "✅ Đã cập nhật chức vụ." : "✅ Đã thêm chức vụ.");
    router.refresh();
    } catch (error) { notify("error", errorMessage(error, "Không thể lưu chức vụ.")); }
    finally { setSaving(false); }
  };

  return <main className="min-h-screen bg-slate-50 p-6 text-slate-900"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4"><div className="mb-4 lg:mb-0"><AppNav currentPath="/job-titles" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} /></div><div>
    <h1 className="mb-4 text-2xl font-bold">Quản lý chức vụ</h1>
    <section className="rounded-xl border bg-white p-4">
      <h2 className="mb-3 font-semibold">{form.id ? "Sửa chức vụ" : "Thêm chức vụ"}</h2>
      <div className="grid gap-2 md:grid-cols-4"><input className="rounded border px-3 py-2" placeholder="Mã (vd: phong_vien)" maxLength={64} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} /><input className="rounded border px-3 py-2" placeholder="Tên chức vụ" maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input className="rounded border px-3 py-2" type="number" min={0} max={100000} placeholder="Thứ tự" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} /><label className="flex items-center gap-2 rounded border px-3 py-2"><input type="checkbox" disabled={Boolean(form.id && !canonicalCodes.has(form.code))} checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Đang sử dụng</label></div>
      <div className="mt-3 flex gap-2"><button disabled={saving} onClick={save} className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu"}</button>{form.id ? <button onClick={() => setForm(blank)} className="rounded bg-slate-200 px-4 py-2 text-sm">Hủy sửa</button> : null}</div>
    </section>
    <p className="my-3 text-sm text-slate-600">{message}</p>
    <section className="rounded-xl border bg-white p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-600">Hiển thị {visibleRows.length}/{rows.length} chức danh</p><select aria-label="Lọc trạng thái chức danh" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as JobTitleStatusFilter)} className="rounded border bg-white px-3 py-2 text-sm"><option value="active">Đang hoạt động</option><option value="locked">Đã khóa</option><option value="all">Tất cả</option></select></div><div className="overflow-auto rounded-lg border"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2">Thứ tự</th><th className="px-3 py-2">Mã</th><th className="px-3 py-2">Tên chức vụ</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2">Thao tác</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id} className="border-t"><td className="px-3 py-2">{row.display_order}</td><td className="px-3 py-2 font-mono text-xs">{row.code}</td><td className="px-3 py-2 font-semibold">{row.name}</td><td className="px-3 py-2">{row.active ? "Đang hoạt động" : canonicalCodes.has(row.code) ? "Đã khóa" : "Cũ · Đã khóa"}</td><td className="px-3 py-2"><button onClick={() => setForm({ id: row.id, code: row.code, name: row.name, display_order: String(row.display_order), active: canonicalCodes.has(row.code) ? row.active : false })} className="rounded bg-slate-200 px-3 py-1 text-xs font-semibold">{canonicalCodes.has(row.code) ? "Sửa / đổi trạng thái" : "Xem chức danh Cũ"}</button></td></tr>)}</tbody></table></div>{!visibleRows.length ? <p className="py-6 text-center text-sm text-slate-500">Không có chức danh phù hợp bộ lọc.</p> : null}</section>
  </div></div></main>;
}
