"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { listEmployeeProfiles, type EmployeeProfile } from "@/lib/services";
import AppNav from "@/components/AppNav";
import { sortStaffRows } from "@/lib/staffOrdering";

type StaffUser = {
  id: string;
  full_name: string;
  username?: string | null;
  active?: boolean;
  list_order?: number | null;
  role_code?: string | null;
  role_level?: number | null;
  job_title_code?: string | null;
  job_title_name?: string | null;
  job_title_display_order?: number | null;
  department_code?: string | null;
  department_name?: string | null;
};

type StaffApiUser = {
  id: string;
  full_name: string;
  username?: string | null;
  active?: boolean;
  list_order?: number | null;
  roles?: { code?: string | null; name?: string | null; level?: number | null } | null;
  job_titles?: { code?: string | null; name?: string | null; display_order?: number | null } | null;
  departments?: { code?: string | null; name?: string | null } | null;
};

export default function HrProfilesPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule, hasPermission, canViewAllWorkHr } = useAuth();

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
    const filteredUsers = staffUsers.filter((su) => {
        const okName = !qName.trim() || su.full_name.toLowerCase().includes(qName.toLowerCase());
        const okDepartment = !qDepartment || (su.department_code ?? "") === qDepartment;
        return okName && okDepartment;
      });

    return sortStaffRows(filteredUsers)
      .map((u) => ({ user: u, profile: profileMap.get(u.id) ?? null }));
  }, [staffUsers, profileMap, qName, qDepartment]);

  const loadData = async () => {
    const [profilesRes, usersResponse] = await Promise.all([
      listEmployeeProfiles(),
      fetch("/api/hr/staff", { cache: "no-store" }),
    ]);

    if (!profilesRes.ok) return setMessage(`❌ ${profilesRes.error}`);
    const usersPayload = await usersResponse.json().catch(() => null) as { error?: string; users?: StaffApiUser[] } | null;
    if (!usersResponse.ok) return setMessage(`❌ ${usersPayload?.error || "Không thể tải dữ liệu nhân sự."}`);

    setRows(profilesRes.data);
    let normalizedUsers = (usersPayload?.users ?? [])
      .filter((u) => u.active !== false)
      .map((u) => ({
        id: u.id,
        full_name: u.full_name,
        username: u.username,
        active: u.active,
        list_order: u.list_order,
        role_code: u.roles?.code ?? null,
        role_level: u.roles?.level ?? null,
        job_title_code: u.job_titles?.code ?? null,
        job_title_name: u.job_titles?.name ?? null,
        job_title_display_order: u.job_titles?.display_order ?? null,
        department_code: u.departments?.code ?? null,
        department_name: u.departments?.name ?? null,
      }));

    if (!hasPermission("can_edit_all_tasks") && !canViewAllWorkHr()) {
      normalizedUsers = normalizedUsers.filter((u) => u.id === user?.id);
    }

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
  }, [authLoading, user, canAccessModule, router, hasPermission]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/hr-profiles" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Hồ sơ nhân sự</h1>
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

          <section className="mt-4 rounded-xl border bg-white p-4">
            <div className="table-scroll rounded-lg border border-slate-200" tabIndex={0} aria-label="Danh sách hồ sơ nhân sự, cuộn ngang để xem thêm">
            <table className="data-table min-w-[960px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-3 py-2">Họ tên</th>
                  <th scope="col" className="px-3 py-2">Chức vụ</th>
                  <th scope="col" className="px-3 py-2">Phòng ban</th>
                  <th scope="col" className="px-3 py-2 text-center">Năm sinh</th>
                  <th scope="col" className="min-w-64 px-3 py-2">Địa chỉ</th>
                  <th scope="col" className="px-3 py-2">SĐT</th>
                  <th scope="col" className="px-3 py-2">Hồ sơ</th>
                </tr>
              </thead>
              <tbody>
                {mergedRows.map(({ user: su, profile }) => (
                  <tr key={su.id} className="cursor-pointer border-t hover:bg-slate-50" onClick={() => router.push(`/hr-profiles/${su.id}`)}>
                    <td className="min-w-52 px-3 py-2">
                      <Link href={`/hr-profiles/${su.id}`} className="inline-flex items-center rounded border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100 px-2 py-1 font-semibold text-orange-800 hover:from-orange-100 hover:to-amber-200" onClick={(e) => e.stopPropagation()}>
                        {su.full_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{su.job_title_name ?? "-"}</td>
                    <td className="px-3 py-2">{su.department_name ?? "-"}</td>
                    <td className="px-3 py-2 text-center">{profile?.date_of_birth ? new Date(profile.date_of_birth).getFullYear() : "-"}</td>
                    <td className="min-w-64 px-3 py-2">{profile?.address ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{profile?.emergency_contact_phone ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link href={`/hr-profiles/${su.id}`} className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-300" onClick={(e) => e.stopPropagation()}>
                        Xem hồ sơ
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
