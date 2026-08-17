"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type {
  DepartmentManagerCandidate,
  DepartmentManagerDepartment,
} from "@/lib/departmentManagerRepository";

type Props = {
  userLabel: string;
  departments: DepartmentManagerDepartment[];
  candidates: DepartmentManagerCandidate[];
  failed: boolean;
};

export default function DepartmentManagerShell({
  userLabel,
  departments,
  candidates,
  failed,
}: Props) {
  const router = useRouter();
  const { logout } = useAuth();
  const [busyDepartment, setBusyDepartment] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const submit = async (departmentId: string, form: FormData) => {
    const managerId = String(form.get("managerId") ?? "");
    if (!managerId) return;
    setBusyDepartment(departmentId);
    setError(false);
    const response = await fetch("/api/department-managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentId, managerId }),
    });
    setBusyDepartment(null);
    if (!response.ok) {
      setError(true);
      return;
    }
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="flex w-full flex-col gap-4 lg:flex-row">
        <AppNav
          currentPath="/configuration/department-managers"
          userLabel={userLabel}
          onLogout={() => { logout(); router.replace("/login"); }}
        />
        <main className="min-w-0 flex-1">
          <header className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Cấu hình</p>
            <h1 className="mt-2 text-2xl font-bold">Trưởng phòng chính</h1>
            <p className="mt-1 text-sm text-slate-600">
              Admin phải chọn rõ một nhân sự đang hoạt động trong chính phòng ban đó.
            </p>
          </header>

          {failed || error ? (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-red-800">
              Không thể thực hiện thao tác.
            </p>
          ) : null}

          <section className="mt-4 space-y-4">
            {departments.map((department) => {
              const eligible = candidates.filter(
                (candidate) => candidate.department_id === department.id,
              );
              const current = eligible.find(
                (candidate) => candidate.id === department.manager_id,
              );
              return (
                <article key={department.id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">{department.code}</p>
                      <h2 className="font-bold">{department.name}</h2>
                    </div>
                    {department.manager_id ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
                        Đã cấu hình
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800">
                        Chưa có Trưởng phòng chính
                      </span>
                    )}
                  </div>
                  {current ? (
                    <p className="mt-2 text-sm text-slate-600">Hiện tại: {current.full_name}</p>
                  ) : null}
                  <form action={(form) => submit(department.id, form)} className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select
                      required
                      name="managerId"
                      defaultValue=""
                      className="min-w-0 flex-1 rounded-lg border px-3 py-2"
                    >
                      <option value="" disabled>Chọn nhân sự trong phòng ban</option>
                      {eligible.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>
                      ))}
                    </select>
                    <button
                      disabled={busyDepartment === department.id || eligible.length === 0}
                      className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
                    >
                      Lưu lựa chọn
                    </button>
                  </form>
                </article>
              );
            })}
          </section>
        </main>
      </div>
    </div>
  );
}
