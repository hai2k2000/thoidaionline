"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import AppNav from "@/components/AppNav";

type Department = { id: string; code: string; name: string; active: boolean };

export default function DepartmentsPage() {
  const router = useRouter();
  const { loading: authLoading, user, hasPermission, logout } = useAuth();

  const [deps, setDeps] = useState<Department[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("Đang tải...");

  const loadDeps = async () => {
    const { data, error } = await supabase.from("departments").select("id,code,name,active").order("name");
    if (error) return setMessage(`❌ ${error.message}`), undefined;
    setDeps((data ?? []) as Department[]);
    setMessage("✅ Đã tải phòng ban.");
  };

  const createDepartment = async () => {
    if (!code.trim() || !name.trim()) return setMessage("❌ Cần nhập mã phòng ban và tên phòng ban."), undefined;
    const normalizedCode = code.trim().toLowerCase().replace(/\s+/g, "-");
    const { error } = await supabase.from("departments").insert({ code: normalizedCode, name: name.trim(), active: true });
    if (error) return setMessage(`❌ ${error.message}`), undefined;
    setCode("");
    setName("");
    await loadDeps();
  };

  const updateDepartment = async (id: string, patch: Partial<Department>) => {
    const { error } = await supabase.from("departments").update(patch).eq("id", id);
    if (error) return setMessage(`❌ ${error.message}`), undefined;
    await loadDeps();
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!hasPermission("can_manage_users")) return void router.push("/");
    const t = setTimeout(() => {
      void loadDeps();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, hasPermission, router]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Quản trị phòng ban</h1>
          <div className="mt-2">
            <AppNav currentPath="/departments" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Tạo phòng ban mới</h2>
          <div className="grid gap-2 md:grid-cols-3">
            <input className="rounded border px-3 py-2" placeholder="Mã phòng ban (vd: content)" value={code} onChange={(e) => setCode(e.target.value)} />
            <input className="rounded border px-3 py-2" placeholder="Tên phòng ban" value={name} onChange={(e) => setName(e.target.value)} />
            <button onClick={createDepartment} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Tạo phòng ban</button>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4 overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2">Mã</th>
                <th className="px-2 py-2">Tên phòng ban</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {deps.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-2 py-2">{d.code}</td>
                  <td className="px-2 py-2">
                    <input className="w-full rounded border px-2 py-1" value={d.name} onChange={(e) => setDeps((prev) => prev.map((x) => x.id === d.id ? { ...x, name: e.target.value } : x))} onBlur={() => updateDepartment(d.id, { name: d.name })} />
                  </td>
                  <td className="px-2 py-2">{d.active ? "Đang dùng" : "Đã khóa"}</td>
                  <td className="px-2 py-2">
                    <button onClick={() => updateDepartment(d.id, { active: !d.active })} className="rounded bg-slate-200 px-2 py-1 text-xs">{d.active ? "Khóa" : "Mở"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
