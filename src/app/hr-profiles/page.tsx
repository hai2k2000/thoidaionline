"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { listEmployeeProfiles, type EmployeeProfile } from "@/lib/services";
import AppNav from "@/components/AppNav";

type StaffUser = {
  id: string;
  full_name: string;
  username?: string | null;
  active?: boolean;
  role_code?: string | null;
  department_code?: string | null;
  department_name?: string | null;
};

export default function HrProfilesPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule } = useAuth();

  const [rows, setRows] = useState<EmployeeProfile[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [message, setMessage] = useState("Đang tải...");

  const [qName, setQName] = useState("");
  const [qDepartment, setQDepartment] = useState("");

  const profileMap = useMemo(() => {
    const m = new Map<string, EmployeeProfile>();
    rows.forEach((r) => m.set(r.user_id, r));
    return m;
  }, [rows]);

  const mergedRows = useMemo(() => {
    const roleRank: Record<string, number> = {
      tong_bien_tap: 1,
      pho_tong_bien_tap: 2,
      phu_trach_phong_tri_su: 3,
      phu_trach_phong_bien_tap: 3,
      phu_trach_phong_phong_vien: 3,
      tri_su: 4,
      bien_tap_vien: 4,
      phong_vien: 5,
    };

    const departmentRank: Record<string, number> = {
      leadership: 1,
      editorial: 2,
      admin: 3,
      reporter: 4,
      general: 5,
    };

    return staffUsers
      .map((u) => ({ user: u, profile: profileMap.get(u.id) ?? null }))
      .filter(({ user: su }) => {
        const okName = !qName.trim() || su.full_name.toLowerCase().includes(qName.toLowerCase());
        const okDepartment = !qDepartment || (su.department_code ?? "") === qDepartment;
        return okName && okDepartment;
      })
      .sort((a, b) => {
        const roleA = roleRank[(a.user as { role_code?: string }).role_code ?? ""] ?? 99;
        const roleB = roleRank[(b.user as { role_code?: string }).role_code ?? ""] ?? 99;
        if (roleA !== roleB) return roleA - roleB;

        const depA = departmentRank[(a.user as { department_code?: string }).department_code ?? ""] ?? 99;
        const depB = departmentRank[(b.user as { department_code?: string }).department_code ?? ""] ?? 99;
        if (depA !== depB) return depA - depB;

        return a.user.full_name.localeCompare(b.user.full_name, "vi");
      });
  }, [staffUsers, profileMap, qName, qDepartment]);

  const loadData = async () => {
    const [profilesRes, usersRes] = await Promise.all([
      listEmployeeProfiles(),
      supabase
        .from("staff_users")
        .select("id,full_name,username,active,roles(code),departments(code,name)")
        .order("full_name"),
    ]);

    if (!profilesRes.ok) return setMessage(`❌ ${profilesRes.error}`);
    if (usersRes.error) return setMessage(`❌ ${usersRes.error.message}`);

    setRows(profilesRes.data);
    const normalizedUsers = ((usersRes.data ?? []) as Array<
      StaffUser & {
        roles?: { code?: string | null } | null;
        departments?: { code?: string | null; name?: string | null } | null;
      }
    >)
      .filter((u) => u.active !== false)
      .map((u) => ({
        id: u.id,
        full_name: u.full_name,
        username: u.username,
        active: u.active,
        role_code: u.roles?.code ?? null,
        department_code: u.departments?.code ?? null,
        department_name: u.departments?.name ?? null,
      }));

    setStaffUsers(normalizedUsers);
    setMessage(`✅ Đã tải ${profilesRes.data.length} hồ sơ trên danh sách nhân viên hiện tại.`);
  };

  const departmentOptions = useMemo(() => {
    const m = new Map<string, string>();
    staffUsers.forEach((u) => {
      if (u.department_code && u.department_name) m.set(u.department_code, u.department_name);
    });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [staffUsers]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("hr")) return void router.push("/");
    const t = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, router]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Hồ sơ nhân sự</h1>
          <div className="mt-2">
            <AppNav currentPath="/hr-profiles" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Lọc nhân sự</h2>
          <div className="grid gap-2 md:grid-cols-3">
            <input
              className="rounded border px-3 py-2"
              placeholder="Lọc theo tên nhân sự"
              value={qName}
              onChange={(e) => setQName(e.target.value)}
            />
            <select className="rounded border px-3 py-2" value={qDepartment} onChange={(e) => setQDepartment(e.target.value)}>
              <option value="">Tất cả phòng ban</option>
              {departmentOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setQName("");
                setQDepartment("");
              }}
              className="rounded bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800"
            >
              Xóa lọc
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4 overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2">Họ tên</th>
                <th className="px-2 py-2">Phòng ban</th>
                <th className="px-2 py-2">Năm sinh</th>
                <th className="px-2 py-2">Địa chỉ</th>
                <th className="px-2 py-2">SĐT</th>
                <th className="px-2 py-2">Hồ sơ</th>
              </tr>
            </thead>
            <tbody>
              {mergedRows.map(({ user: su, profile }) => (
                <tr key={su.id} className="cursor-pointer border-t hover:bg-slate-50" onClick={() => router.push(`/hr-profiles/${su.id}`)}>
                  <td className="px-2 py-2">
                    <Link href={`/hr-profiles/${su.id}`} className="inline-flex items-center rounded border border-blue-200 bg-gradient-to-r from-sky-50 to-blue-100 px-2 py-1 font-semibold text-blue-800 hover:from-sky-100 hover:to-blue-200" onClick={(e) => e.stopPropagation()}>
                      {su.full_name}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{su.department_name ?? "-"}</td>
                  <td className="px-2 py-2">{profile?.date_of_birth ? new Date(profile.date_of_birth).getFullYear() : "-"}</td>
                  <td className="px-2 py-2">{profile?.address ?? "-"}</td>
                  <td className="px-2 py-2">{profile?.emergency_contact_phone ?? "-"}</td>
                  <td className="px-2 py-2">
                    <Link href={`/hr-profiles/${su.id}`} className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-300" onClick={(e) => e.stopPropagation()}>
                      Xem hồ sơ
                    </Link>
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
