"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import DatabaseRecordForm from "@/components/DatabaseRecordForm";
import { useAuth } from "@/lib/auth";

type FormField = { field_key: string; label: string; data_type: string; required: boolean; options?: Array<{ value: string; label: string }> };
type Catalog = { categories: Array<{ id: string; name: string }>; recordTypes: Array<{ id: string; category_id: string; name: string }>; forms: Array<{ record_type_id: string; db_form_fields?: FormField[] }> };

export default function DatabaseRecordNewPage() {
  const router = useRouter();
  const { loading, user, logout, hasPermission } = useAuth();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [message, setMessage] = useState("Đang tải biểu mẫu...");
  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (!hasPermission("record.create")) { router.push("/"); return; }
    void fetch("/api/database/catalog", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json().catch(() => null) as Catalog | null;
      if (!response.ok || !payload) throw new Error("Không thể tải cấu hình hồ sơ.");
      setCatalog(payload); setMessage("");
    }).catch((error) => setMessage(error.message));
  }, [loading, user, hasPermission, router]);
  if (loading || !user) return <main className="grid min-h-screen place-items-center bg-slate-50">Đang tải...</main>;
  return <main className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4"><div className="mb-4 lg:mb-0"><AppNav currentPath="/database/records/new" userLabel={`${user.full_name} (${user.role_name})`} onLogout={logout} /></div><div><header className="mb-4"><p className="text-xs font-bold uppercase text-orange-700">Cơ sở dữ liệu</p><h1 className="mt-1 text-2xl font-bold">Nhập hồ sơ mới</h1><p className="mt-1 text-sm text-slate-600">Mã hồ sơ được tự động tạo khi lưu.</p></header><section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">{catalog ? <DatabaseRecordForm mode="create" catalog={catalog} /> : <p className="text-sm text-slate-600">{message}</p>}</section></div></div></main>;
}
