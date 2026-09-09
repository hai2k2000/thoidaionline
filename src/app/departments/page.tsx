"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import AppNav from "@/components/AppNav";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

type Department = { id: string; code: string; name: string; active: boolean };
type DepartmentPayload = { departments?: Department[]; error?: { code?: string } };
type DepartmentStatusFilter = "active" | "locked" | "all";

export default function DepartmentsPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout } = useAuth();
  const { notify } = useActionFeedback();
  const [busy, setBusy] = useState(false);

  const [deps, setDeps] = useState<Department[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("Đang tải...");
  const [statusFilter, setStatusFilter] = useState<DepartmentStatusFilter>("active");
  const visibleDepartments = deps.filter((department) => statusFilter === "all" || department.active === (statusFilter === "active"));

  const loadDeps = async () => {
    try {
      const response = await fetch("/api/departments", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as DepartmentPayload | null;
      if (!response.ok) throw new Error(payload?.error?.code || "operation_failed");
      setDeps(payload?.departments ?? []);
      setMessage("✅ Đã tải phòng ban.");
    } catch {
      setMessage("❌ Không thể tải phòng ban.");
    }
  };

  const createDepartment = async () => {
    if (busy) return;
    if (!code.trim() || !name.trim()) return notify("error", "Cần nhập mã phòng ban và tên phòng ban.");
    const normalizedCode = code.trim().toLowerCase().replace(/\s+/g, "-");
    setBusy(true);
    try { const response = await fetch("/api/departments", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: normalizedCode, name: name.trim() }),
    });
    if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể tạo phòng ban."));
    setCode("");
    setName("");
    notify("success", "Đã tạo phòng ban."); await loadDeps();
    } catch (error) { notify("error", errorMessage(error, "Không thể tạo phòng ban.")); }
    finally { setBusy(false); }
  };

  const updateDepartment = async (id: string, patch: Partial<Department>) => {
    if (busy) return;
    setBusy(true);
    try { const response = await fetch("/api/departments", {
      method: "PATCH",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, name: patch.name, active: patch.active }),
    });
    if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể cập nhật phòng ban."));
    notify("success", "Đã cập nhật phòng ban."); await loadDeps();
    } catch (error) { notify("error", errorMessage(error, "Không thể cập nhật phòng ban.")); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (user.role_code !== "admin" || !user.permissions.can_manage_users) return void router.push("/");
    const t = setTimeout(() => {
      void loadDeps();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, router]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/departments" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Quản trị phòng ban</h1>
          </div>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Tạo phòng ban mới</h2>
          <div className="grid gap-2 md:grid-cols-3">
            <input className="rounded border px-3 py-2" placeholder="Mã phòng ban (vd: content)" value={code} onChange={(e) => setCode(e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Tên phòng ban" value={name} onChange={(e) => setName(e.target.value)} />
            <button disabled={busy} onClick={createDepartment} className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50">{busy ? "Đang lưu..." : "Tạo phòng ban"}</button>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">Hiển thị {visibleDepartments.length}/{deps.length} phòng ban</p>
            <label className="flex items-center gap-2 text-sm font-semibold">Trạng thái
              <select aria-label="Lọc trạng thái phòng ban" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DepartmentStatusFilter)} className="rounded border bg-white px-3 py-2 font-normal">
                <option value="active">Đang hoạt động</option>
                <option value="locked">Đã khóa</option>
                <option value="all">Tất cả</option>
              </select>
            </label>
          </div>
          <div className="table-scroll rounded-lg border border-slate-200" tabIndex={0} aria-label="Danh sách phòng ban, cuộn ngang để xem thêm">
          <table className="data-table min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-3 py-2">Mã</th>
                <th scope="col" className="px-3 py-2">Tên phòng ban</th>
                <th scope="col" className="px-3 py-2">Trạng thái</th>
                <th scope="col" className="px-3 py-2">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {visibleDepartments.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{d.code}</td>
                  <td className="min-w-64 px-3 py-2">
                    <input className="w-full rounded border px-2 py-1" value={d.name} onChange={(e) => setDeps((prev) => prev.map((x) => x.id === d.id ? { ...x, name: e.target.value } : x))} onBlur={() => updateDepartment(d.id, { name: d.name })} />
                  </td>
                  <td className="px-3 py-2"><span className={`table-status ${d.active ? "table-status-success" : "table-status-neutral"}`}>{d.active ? "Đang dùng" : "Đã khóa"}</span></td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button onClick={() => updateDepartment(d.id, { active: !d.active })} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-800">{d.active ? "Khóa" : "Mở"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {!visibleDepartments.length ? <p className="py-6 text-center text-sm text-slate-500">Không có phòng ban phù hợp bộ lọc.</p> : null}
        </section>
        </div>
      </div>
    </main>
  );
}
