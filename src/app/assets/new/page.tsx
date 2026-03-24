"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { assignAsset, createAsset } from "@/lib/services";

type StaffUser = { id: string; full_name: string; username?: string | null; active?: boolean };
type Department = { id: string; name: string; active?: boolean };

export default function AssetCreatePage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule } = useAuth();

  const [assetCode, setAssetCode] = useState("");
  const [assetName, setAssetName] = useState("");
  const [category, setCategory] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [status, setStatus] = useState<"available" | "in_use" | "maintenance" | "broken" | "liquidated">("in_use");
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
      const [usersRes, depsRes] = await Promise.all([
        supabase.from("staff_users").select("id,full_name,username,active").eq("active", true).order("full_name"),
        supabase.from("departments").select("id,name,active").eq("active", true).order("name"),
      ]);

      if (usersRes.error || depsRes.error) {
        setMessage(`⚠️ ${usersRes.error?.message || depsRes.error?.message}`);
        return;
      }

      setUsers((usersRes.data ?? []) as StaffUser[]);
      setDepartments((depsRes.data ?? []) as Department[]);
    }, 0);

    return () => clearTimeout(t);
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
      if (!assignRes.ok) return setMessage(`⚠️ Đã thêm tài sản nhưng giao chưa thành công: ${assignRes.error}`);
    }

    setMessage("✅ Đã thêm tài sản.");
    setAssetCode("");
    setAssetName("");
    setCategory("");
    setSerialNumber("");
    setStatus("in_use");
    setNote("");
    setAssigneeId("");
    setDepartmentId("");
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
              <option value="in_use">Đang sử dụng</option>
              <option value="maintenance">Bảo trì</option>
              <option value="broken">Hỏng</option>
              <option value="liquidated">Thanh lý</option>
            </select>
            <input className="rounded border px-3 py-2" placeholder="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} />

            <select className="rounded border px-3 py-2" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Giao cho ai (không bắt buộc)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}{u.username ? ` (${u.username})` : ""}</option>
              ))}
            </select>

            <select className="rounded border px-3 py-2" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Hoặc giao cho phòng ban (không bắt buộc)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <p className="mt-2 text-xs text-slate-500">Có thể chọn giao cho nhân viên hoặc phòng ban ngay khi thêm tài sản.</p>
          <div className="mt-3">
            <button onClick={onCreate} className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Thêm tài sản</button>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>
      </div>
    </main>
  );
}
