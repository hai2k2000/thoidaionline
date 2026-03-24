"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { upsertEmployeeProfile, type EmployeeProfile } from "@/lib/services";

type Staff = {
  id: string;
  full_name: string;
  username?: string | null;
  email?: string | null;
  roles?: { name?: string | null } | null;
  departments?: { name?: string | null } | null;
};

export default function HrProfileDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule } = useAuth();

  const [staff, setStaff] = useState<Staff | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [message, setMessage] = useState("Đang tải...");
  const [saving, setSaving] = useState(false);
  const [profileFile, setProfileFile] = useState<File | null>(null);

  const load = async (id: string) => {
    const [sRes, pRes] = await Promise.all([
      supabase
        .from("staff_users")
        .select("id,full_name,username,email,roles(name),departments(name)")
        .eq("id", id)
        .single(),
      supabase.from("employee_profiles").select("*").eq("user_id", id).maybeSingle(),
    ]);

    if (sRes.error) return setMessage(`❌ ${sRes.error.message}`);
    if (pRes.error) return setMessage(`❌ ${pRes.error.message}`);

    setStaff((sRes.data ?? null) as Staff | null);
    setProfile(
      ((pRes.data ?? { user_id: id }) as EmployeeProfile) || {
        user_id: id,
      }
    );
    setMessage("✅ Đã tải hồ sơ.");
  };

  const save = async () => {
    if (!profile || !params?.id) return;
    setSaving(true);
    try {
      let payload: EmployeeProfile = { ...profile, user_id: params.id };

      if (profileFile) {
        const fd = new FormData();
        fd.append("file", profileFile);
        fd.append("userId", params.id);
        const upRes = await fetch("/api/hr/upload", { method: "POST", body: fd });
        const upJson = await upRes.json();
        if (!upRes.ok) throw new Error(upJson?.error || "Upload file lỗi");
        payload = { ...payload, profile_file_url: upJson.url };
      }

      const r = await upsertEmployeeProfile(payload, user?.id);
      if (!r.ok) throw new Error(r.error);
      setProfile(r.data);
      setProfileFile(null);
      setMessage("✅ Đã cập nhật hồ sơ nhân sự.");
    } catch (e) {
      setMessage(`❌ ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("hr")) return void router.push("/");
    if (!params?.id) return;
    const t = setTimeout(() => {
      void load(params.id);
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, params?.id, router]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Chi tiết hồ sơ nhân sự</h1>
          <div className="mt-2">
            <AppNav currentPath="/hr-profiles" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>

        <p className="mb-3 text-sm text-slate-600">{message}</p>

        <section className="rounded-xl border bg-white p-4">
          <div className="mb-3">
            <Link href="/hr-profiles" className="inline-flex items-center rounded border border-blue-200 bg-gradient-to-r from-cyan-50 to-blue-200 px-2 py-1 text-sm font-semibold text-blue-800 hover:from-cyan-100 hover:to-blue-300">
              ← Quay lại danh sách hồ sơ nhân sự
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div><b>Họ tên:</b> {staff?.full_name ?? "-"}</div>
            <div><b>Username:</b> {staff?.username ?? "-"}</div>
            <div><b>Email:</b> {staff?.email ?? "-"}</div>
            <div><b>Phòng ban:</b> {staff?.departments?.name ?? "-"}</div>
            <div><b>Chức vụ:</b> {staff?.roles?.name ?? "-"}</div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày sinh</label>
              <input className="w-full rounded border px-3 py-2" type="date" value={profile?.date_of_birth ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), date_of_birth: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">SĐT</label>
              <input className="w-full rounded border px-3 py-2" value={profile?.emergency_contact_phone ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), emergency_contact_phone: e.target.value || null }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Địa chỉ</label>
              <input className="w-full rounded border px-3 py-2" value={profile?.address ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), address: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Số giấy tờ</label>
              <input className="w-full rounded border px-3 py-2" value={profile?.id_number ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), id_number: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Loại hợp đồng</label>
              <select className="w-full rounded border px-3 py-2" value={profile?.contract_type ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), contract_type: (e.target.value || null) as EmployeeProfile["contract_type"] }))}>
                <option value="">-</option>
                <option value="intern">intern</option>
                <option value="probation">probation</option>
                <option value="official">official</option>
                <option value="contractor">contractor</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày vào làm</label>
              <input className="w-full rounded border px-3 py-2" type="date" value={profile?.join_date ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), join_date: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Bắt đầu HĐ</label>
              <input className="w-full rounded border px-3 py-2" type="date" value={profile?.contract_start ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), contract_start: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Kết thúc HĐ</label>
              <input className="w-full rounded border px-3 py-2" type="date" value={profile?.contract_end ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), contract_end: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Người liên hệ khẩn</label>
              <input className="w-full rounded border px-3 py-2" value={profile?.emergency_contact_name ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), emergency_contact_name: e.target.value || null }))} />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Tệp hợp đồng lao động</label>
              <input className="rounded border px-3 py-2" type="file" onChange={(e) => setProfileFile(e.target.files?.[0] ?? null)} />
              <div className="mt-2 text-sm">
                <b>File hiện tại:</b>{" "}
                {profile?.profile_file_url ? (
                  <a href={profile.profile_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded border border-blue-200 bg-gradient-to-r from-cyan-50 to-blue-200 px-2 py-1 text-sm font-semibold text-blue-800 hover:from-cyan-100 hover:to-blue-300">
                    Xem file đã upload
                  </a>
                ) : (
                  "-"
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <button onClick={save} disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Đang lưu..." : "Lưu cập nhật"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
