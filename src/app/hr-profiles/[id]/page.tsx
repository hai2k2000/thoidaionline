"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { upsertEmployeeProfile, type EmployeeProfile } from "@/lib/services";
import { errorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

type Staff = {
  id: string;
  full_name: string;
  username?: string | null;
  email?: string | null;
  roles?: { name?: string | null } | null;
  job_titles?: { name?: string | null } | null;
  departments?: { name?: string | null } | null;
};

type StaffResponse = { error?: string; users?: Staff[] };

export default function HrProfileDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule, hasPermission, isReadOnly, canViewAllWorkHr } = useAuth();
  const { notify } = useActionFeedback();

  const [staff, setStaff] = useState<Staff | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [message, setMessage] = useState("Đang tải...");
  const [saving, setSaving] = useState(false);
  const [profileFile, setProfileFile] = useState<File | null>(null);

  const load = async (id: string) => {
    const [staffResponse, profileResponse] = await Promise.all([
      fetch(`/api/hr/staff?user_id=${encodeURIComponent(id)}`, { cache: "no-store" }),
      fetch(`/api/hr/profiles?user_id=${encodeURIComponent(id)}`, { cache: "no-store" }),
    ]);

    const staffPayload = await staffResponse.json().catch(() => null) as StaffResponse | null;
    const profilePayload = await profileResponse.json().catch(() => null) as { error?: string; profiles?: EmployeeProfile[] } | null;
    if (!staffResponse.ok) return setMessage(`❌ ${staffPayload?.error || "Không thể tải dữ liệu nhân sự."}`);
    if (!profileResponse.ok) return setMessage(`❌ ${profilePayload?.error || "Không thể tải hồ sơ nhân sự."}`);

    setStaff(staffPayload?.users?.[0] ?? null);
    setProfile(profilePayload?.profiles?.[0] ?? { user_id: id });
    setMessage("✅ Đã tải hồ sơ.");
  };

  const save = async () => {
    if (!profile || !params?.id || isReadOnly()) return;
    setSaving(true);
    try {
      let payload: EmployeeProfile = { ...profile, user_id: params.id };

      if (profileFile) {
        const fd = new FormData();
        fd.append("file", profileFile);
        fd.append("userId", params.id);
        const upRes = await fetch("/api/hr/upload", { method: "POST", body: fd });
        const upJson = await upRes.json();
        if (!upRes.ok) throw new Error(upJson?.error || "Tải tệp lên thất bại");
        payload = { ...payload, profile_file_url: upJson.url };
      }

      const r = await upsertEmployeeProfile(payload, user?.id);
      if (!r.ok) throw new Error(r.error);
      setProfile(r.data);
      setProfileFile(null);
      notify("success", "Đã cập nhật hồ sơ nhân sự."); setMessage("✅ Đã cập nhật hồ sơ nhân sự.");
    } catch (e) {
      const text = errorMessage(e, "Không thể cập nhật hồ sơ nhân sự."); notify("error", text); setMessage(`❌ ${text}`);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("hr")) return void router.push("/");
    if (!params?.id) return;
    if (!hasPermission("can_edit_all_tasks") && !canViewAllWorkHr() && params.id !== user.id) {
      return void router.push(`/hr-profiles/${user.id}`);
    }
    const t = setTimeout(() => {
      void load(params.id);
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, params?.id, router, hasPermission, canViewAllWorkHr]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/hr-profiles" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Chi tiết hồ sơ nhân sự</h1>
          </div>

        <p className="mb-3 text-sm text-slate-600">{message}</p>

        <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3">
            <Link href="/hr-profiles" className="inline-flex min-h-10 items-center rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100">
              ← Quay lại danh sách hồ sơ nhân sự
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Họ tên</p><p className="mt-1 font-semibold">{staff?.full_name ?? "-"}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tên đăng nhập</p><p className="mt-1 font-mono text-sm">{staff?.username ?? "-"}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thư điện tử</p><p className="mt-1">{staff?.email ?? "-"}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phòng ban</p><p className="mt-1">{staff?.departments?.name ?? "-"}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chức vụ</p><p className="mt-1">{staff?.job_titles?.name ?? "-"}</p></div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày sinh</label>
              <input className="min-h-11 w-full rounded-lg border px-3 py-2" type="date" value={profile?.date_of_birth ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), date_of_birth: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">SĐT</label>
              <input className="min-h-11 w-full rounded-lg border px-3 py-2" value={profile?.emergency_contact_phone ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), emergency_contact_phone: e.target.value || null }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Địa chỉ</label>
              <input className="min-h-11 w-full rounded-lg border px-3 py-2" value={profile?.address ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), address: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Số giấy tờ</label>
              <input className="min-h-11 w-full rounded-lg border px-3 py-2" value={profile?.id_number ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), id_number: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Loại hợp đồng</label>
              <select className="min-h-11 w-full rounded-lg border px-3 py-2" value={profile?.contract_type ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), contract_type: (e.target.value || null) as EmployeeProfile["contract_type"] }))}>
                <option value="">-</option>
                <option value="intern">Thực tập</option>
                <option value="probation">Thử việc</option>
                <option value="official">Chính thức</option>
                <option value="contractor">Cộng tác viên</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày vào làm</label>
              <input className="min-h-11 w-full rounded-lg border px-3 py-2" type="date" value={profile?.join_date ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), join_date: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Bắt đầu HĐ</label>
              <input className="min-h-11 w-full rounded-lg border px-3 py-2" type="date" value={profile?.contract_start ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), contract_start: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Kết thúc HĐ</label>
              <input className="min-h-11 w-full rounded-lg border px-3 py-2" type="date" value={profile?.contract_end ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), contract_end: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Người liên hệ khẩn</label>
              <input className="min-h-11 w-full rounded-lg border px-3 py-2" value={profile?.emergency_contact_name ?? ""} onChange={(e) => setProfile((p) => ({ ...(p ?? { user_id: params?.id ?? "" }), emergency_contact_name: e.target.value || null }))} />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tệp hợp đồng lao động</label>
              <input className="min-h-11 rounded-lg border px-3 py-2" type="file" onChange={(e) => setProfileFile(e.target.files?.[0] ?? null)} />
              <div className="mt-2 text-sm">
                <b>Tệp hiện tại:</b>{" "}
                {profile?.profile_file_url ? (
                  <a href={profile.profile_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100 px-2 py-1 text-sm font-semibold text-orange-800 hover:from-orange-100 hover:to-amber-200">
                    Xem file đã upload
                  </a>
                ) : (
                  "-"
                )}
              </div>
            </div>
          </div>

          {!isReadOnly() ? (
          <div className="mt-4">
            <button onClick={save} disabled={saving} className="min-h-11 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
              {saving ? "Đang lưu..." : "Lưu cập nhật"}
            </button>
          </div>
          ) : null}
        </section>
        </div>
      </div>
    </main>
  );
}
