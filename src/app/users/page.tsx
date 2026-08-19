"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppNav from "@/components/AppNav";
import { sortStaffRows } from "@/lib/staffOrdering";
import {
  getPasswordResetDisabledReason,
  passwordResetMessage,
} from "@/lib/adminPasswordResetUi";
import {
  getPasswordPolicyError,
  PASSWORD_POLICY_HINT,
} from "@/lib/passwordPolicy";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import PasswordInput from "@/components/PasswordInput";

type Role = { id: string; code?: string; name: string; level?: number };
type JobTitle = {
  id: string;
  code?: string;
  name: string;
  display_order?: number;
  active?: boolean;
};
type Department = { id: string; code?: string; name: string; active?: boolean };
type User = {
  id: string;
  full_name: string;
  username?: string | null;
  email: string | null;
  phone?: string | null;
  role_id: string;
  job_title_id?: string | null;
  department_id: string;
  active: boolean;
  list_order?: number | null;
  roles?: { code?: string; name?: string; level?: number } | null;
  job_titles?: {
    code?: string;
    name?: string;
    display_order?: number;
    active?: boolean;
  } | null;
  departments?: { code?: string; name?: string } | null;
};
type UsersPayload = {
  error?: string;
  roles?: Role[];
  job_titles?: JobTitle[];
  departments?: Department[];
  users?: User[];
};
type ResetState = "idle" | "confirming" | "submitting" | "success" | "error";
type SetPasswordState = "idle" | "editing" | "submitting";

const canViewUsers = (code: string) =>
  ["admin", "tong_bien_tap", "tbt_read_only"].includes(code);

export default function UsersPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout } = useAuth();
  const { notify } = useActionFeedback();
  const [roles, setRoles] = useState<Role[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [deps, setDeps] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("Đang tải...");
  const [filterDepId, setFilterDepId] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "disabled"
  >("all");
  const [selected, setSelected] = useState<User | null>(null);
  const [resetState, setResetState] = useState<ResetState>("idle");
  const [resetToast, setResetToast] = useState("");
  const [setPasswordState, setSetPasswordState] =
    useState<SetPasswordState>("idle");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editDep, setEditDep] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [newUser, setNewUser] = useState({
    full_name: "",
    username: "",
    role_id: "",
    job_title_id: "",
    department_id: "",
  });
  const [savingUser, setSavingUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const isAdmin = user?.role_code === "admin";

  const fetchAll = async () => {
    const response = await fetch("/api/users", { cache: "no-store" });
    const payload = (await response
      .json()
      .catch(() => null)) as UsersPayload | null;
    if (!response.ok)
      throw new Error(payload?.error || "Không thể tải danh sách.");
    return payload ?? {};
  };

  const applyPayload = (payload: UsersPayload) => {
    setRoles(payload?.roles ?? []);
    setJobTitles(payload?.job_titles ?? []);
    setDeps(payload?.departments ?? []);
    setUsers(payload?.users ?? []);
  };

  const loadAll = async (successMessage = "✅ Đã tải danh sách nhân viên.") => {
    try {
      const payload = await fetchAll();
      applyPayload(payload);
      setMessage(successMessage);
    } catch (error) {
      setMessage(`❌ ${(error as Error).message}`);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canViewUsers(user.role_code)) return void router.push("/");
    const t = setTimeout(() => {
      void loadAll();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, router]);

  const filteredUsers = useMemo(() => {
    const filtered = users.filter((u) => {
      const okDep = !filterDepId || u.department_id === filterDepId;
      const okStatus =
        filterStatus === "all" ||
        (filterStatus === "active" ? u.active : !u.active);
      return okDep && okStatus;
    });
    return sortStaffRows(filtered);
  }, [users, filterDepId, filterStatus]);

  const clearPasswordResetState = () => {
    setResetState("idle");
    setResetToast("");
    setSetPasswordState("idle");
    setNewPassword("");
    setConfirmPassword("");
  };

  const canCloseSelectedUser =
    resetState !== "submitting" && setPasswordState !== "submitting";

  const closeSelectedUser = () => {
    if (!canCloseSelectedUser) return;
    clearPasswordResetState();
    setSelected(null);
  };

  const setEditState = (u: User) => {
    clearPasswordResetState();
    setSelected(u);
    setEditName(u.full_name);
    setEditEmail(u.email ?? "");
    setEditPhone(u.phone ?? "");
    setEditRole(u.role_id);
    setEditJobTitle(u.job_title_id ?? "");
    setEditDep(u.department_id);
    setEditActive(u.active);
  };

  const openUser = async (u: User) => {
    setMessage("Đang tải thông tin mới nhất...");
    try {
      const payload = await fetchAll();
      applyPayload(payload);
      const freshUser = (payload.users ?? []).find((row) => row.id === u.id);
      if (!freshUser) throw new Error("Không tìm thấy user.");
      setEditState(freshUser);
      setMessage("✅ Đã tải thông tin mới nhất.");
    } catch (error) {
      clearPasswordResetState();
      setSelected(null);
      setMessage(`❌ ${(error as Error).message}`);
    }
  };

  const saveUser = async () => {
    if (!selected || !isAdmin) return;
    if (!editJobTitle) return notify("error", "Vui lòng chọn chức vụ.");
    const changes: Record<string, string | boolean> = { user_id: selected.id };
    if (editName.trim() !== selected.full_name) changes.full_name = editName;
    if (editEmail.trim().toLowerCase() !== (selected.email ?? "").toLowerCase())
      changes.email = editEmail.trim().toLowerCase();
    if (editPhone.trim() !== (selected.phone ?? ""))
      changes.phone = editPhone.trim();
    if (editRole !== selected.role_id) changes.role_id = editRole;
    if (editJobTitle !== (selected.job_title_id ?? ""))
      changes.job_title_id = editJobTitle;
    if (editDep !== selected.department_id) changes.department_id = editDep;
    if (editActive !== selected.active) changes.active = editActive;
    if (Object.keys(changes).length === 1)
      return notify("error", "Không có thay đổi để lưu.");
    setSavingUser(true);
    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!response.ok)
        throw new Error(
          await responseErrorMessage(response, "Không thể cập nhật user."),
        );
      clearPasswordResetState();
      setSelected(null);
      notify("success", "Đã cập nhật thông tin user.");
      await loadAll("✅ Đã cập nhật thông tin user.");
      router.refresh();
    } catch (error) {
      notify("error", errorMessage(error, "Không thể cập nhật user."));
    } finally {
      setSavingUser(false);
    }
  };

  const submitPasswordReset = async () => {
    if (!selected || !isAdmin || resetState === "submitting") return;
    setResetState("submitting");
    setResetToast("");
    try {
      const response = await fetch("/api/auth/admin-reset", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: selected.id }),
      });
      const payload = (await response.json()) as { code?: string };
      const code = payload?.code ?? "unknown";
      const notice = passwordResetMessage(code);
      notify(response.ok ? "success" : "error", notice);
      setResetToast(notice);
      setResetState(response.ok ? "success" : "error");
    } catch {
      setResetToast(passwordResetMessage("network_error"));
      setResetState("error");
    } finally {
      setResetState((current) =>
        current === "submitting" ? "error" : current,
      );
    }
  };

  const submitAdminSetPassword = async () => {
    if (!selected || !isAdmin || setPasswordState === "submitting") return;
    if (selected.id === user?.id)
      return notify(
        "error",
        "Hãy dùng chức năng quên mật khẩu cho tài khoản Admin đang đăng nhập.",
      );
    if (!selected.active)
      return notify("error", "Không thể đặt mật khẩu cho tài khoản đã khóa.");
    if (newPassword !== confirmPassword)
      return notify("error", "Mật khẩu xác nhận không khớp.");
    const policyError = getPasswordPolicyError(newPassword);
    if (policyError) return notify("error", policyError);
    setSetPasswordState("submitting");
    setResetToast("");
    try {
      const response = await fetch("/api/auth/admin-set-password", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: selected.id,
          newPassword,
          confirmPassword,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(payload?.error || "Không thể cập nhật mật khẩu.");
      if (response.ok) {
        clearPasswordResetState();
        setSelected(null);
        notify("success", payload?.message || "Đã cập nhật mật khẩu.");
      }
    } catch (error) {
      notify("error", errorMessage(error, "Lỗi kết nối. Vui lòng thử lại."));
      setSetPasswordState("editing");
    } finally {
      setSetPasswordState((current) =>
        current === "submitting" ? "editing" : current,
      );
    }
  };

  const createUser = async () => {
    if (!isAdmin) return;
    setCreatingUser(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (!response.ok)
        throw new Error(
          await responseErrorMessage(response, "Không thể tạo user."),
        );
      setNewUser({
        full_name: "",
        username: "",
        role_id: "",
        job_title_id: "",
        department_id: "",
      });
      notify("success", "Đã tạo user.");
      await loadAll("✅ Đã tạo user.");
      router.refresh();
    } catch (error) {
      notify("error", errorMessage(error, "Không thể tạo user."));
    } finally {
      setCreatingUser(false);
    }
  };

  const resetDisabledReason = selected
    ? getPasswordResetDisabledReason(selected, resetState === "submitting")
    : null;

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav
            currentPath="/users"
            userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`}
            onLogout={logout}
          />
        </div>
        <div>
          <h1 className="mb-4 text-2xl font-bold">Quản lý nhân viên</h1>
          {isAdmin ? (
            <section className="rounded-xl border bg-white p-4">
              <h2 className="mb-2 font-semibold">Tạo user</h2>
              <div className="grid gap-2 md:grid-cols-5">
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Họ tên"
                  value={newUser.full_name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, full_name: e.target.value })
                  }
                />
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                />
                <select
                  className="rounded border px-3 py-2"
                  value={newUser.job_title_id}
                  onChange={(e) =>
                    setNewUser({ ...newUser, job_title_id: e.target.value })
                  }
                >
                  <option value="">Chức vụ</option>
                  {jobTitles
                    .filter((j) => j.active !== false)
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                </select>
                <select
                  className="rounded border px-3 py-2"
                  value={newUser.role_id}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role_id: e.target.value })
                  }
                >
                  <option value="">Role quyền</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border px-3 py-2"
                  value={newUser.department_id}
                  onChange={(e) =>
                    setNewUser({ ...newUser, department_id: e.target.value })
                  }
                >
                  <option value="">Phòng ban</option>
                  {deps
                    .filter((d) => d.active !== false)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
              <button
                disabled={creatingUser}
                onClick={createUser}
                className="mt-3 rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
              >
                {creatingUser ? "Đang tạo..." : "Tạo user"}
              </button>
            </section>
          ) : null}
          <section className="mt-4 rounded-xl border bg-white p-4">
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <select
                className="rounded border px-3 py-2"
                value={filterDepId}
                onChange={(e) => setFilterDepId(e.target.value)}
              >
                <option value="">Lọc theo phòng ban (tất cả)</option>
                {deps
                  .filter((d) => d.active !== false)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
              <select
                className="rounded border px-3 py-2"
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(
                    e.target.value as "all" | "active" | "disabled",
                  )
                }
              >
                <option value="all">Trạng thái: Tất cả</option>
                <option value="active">Active</option>
                <option value="disabled">Disable</option>
              </select>
              <button
                onClick={() => {
                  setFilterDepId("");
                  setFilterStatus("all");
                }}
                className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold"
              >
                Xóa bộ lọc
              </button>
            </div>
            <p className="mb-2 text-sm text-slate-600">{message}</p>
            <div className="overflow-auto rounded-lg border">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-2">Họ tên</th>
                    <th className="px-2 py-2">Username</th>
                    <th className="px-2 py-2">Chức vụ</th>
                    <th className="px-2 py-2">Role quyền</th>
                    <th className="px-2 py-2">Phòng ban</th>
                    <th className="px-2 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="px-2 py-2">
                        <button
                          onClick={() => void openUser(u)}
                          className="font-semibold text-orange-800 underline-offset-2 hover:underline"
                        >
                          {u.full_name}
                        </button>
                      </td>
                      <td className="px-2 py-2">{u.username ?? "-"}</td>
                      <td className="px-2 py-2">{u.job_titles?.name ?? "-"}</td>
                      <td className="px-2 py-2">{u.roles?.name ?? "-"}</td>
                      <td className="px-2 py-2">
                        {deps.find((d) => d.id === u.department_id)?.name ??
                          "-"}
                      </td>
                      <td className="px-2 py-2">
                        {u.active ? "active" : "disable"}
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-6 text-center text-slate-500"
                      >
                        Không có user phù hợp bộ lọc.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
          {selected ? (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget && canCloseSelectedUser)
                  closeSelectedUser();
              }}
            >
              <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Thông tin nhân sự</h2>
                  <button
                    type="button"
                    disabled={!canCloseSelectedUser}
                    onClick={closeSelectedUser}
                    className="text-xl disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Đóng"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm">
                    Họ tên
                    <input
                      disabled={!isAdmin}
                      className="mt-1 w-full rounded border px-3 py-2 disabled:bg-slate-100"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </label>
                  <p className="text-sm">
                    <b>Username:</b> {selected.username ?? "-"}
                  </p>
                  <label className="block text-sm">
                    Email
                    <input type="email" maxLength={254} disabled={!isAdmin || savingUser} className="mt-1 w-full rounded border px-3 py-2 disabled:bg-slate-100" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  </label>
                  <label className="block text-sm">
                    Số điện thoại
                    <input type="tel" maxLength={32} disabled={!isAdmin || savingUser} className="mt-1 w-full rounded border px-3 py-2 disabled:bg-slate-100" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                  </label>
                  <label className="block text-sm">
                    Chức vụ
                    <select
                      disabled={!isAdmin}
                      className="mt-1 w-full rounded border px-3 py-2 disabled:bg-slate-100"
                      value={editJobTitle}
                      onChange={(e) => setEditJobTitle(e.target.value)}
                    >
                      <option value="" disabled>
                        Chọn chức vụ
                      </option>
                      {jobTitles
                        .filter(
                          (j) => j.active !== false || j.id === editJobTitle,
                        )
                        .map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.name}
                            {j.active === false ? " (đã ngừng sử dụng)" : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Role quyền
                    <select
                      disabled={!isAdmin}
                      className="mt-1 w-full rounded border px-3 py-2 disabled:bg-slate-100"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Phòng ban
                    <select
                      disabled={!isAdmin}
                      className="mt-1 w-full rounded border px-3 py-2 disabled:bg-slate-100"
                      value={editDep}
                      onChange={(e) => setEditDep(e.target.value)}
                    >
                      {deps
                        .filter((d) => d.active !== false)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={editActive}
                      onChange={(e) => setEditActive(e.target.checked)}
                    />{" "}
                    Đang hoạt động
                  </label>
                </div>
                {resetToast ? (
                  <p
                    role={resetState === "error" ? "alert" : "status"}
                    className="mt-3 text-sm text-slate-700"
                  >
                    {resetToast}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap items-start gap-2">
                  {isAdmin ? (
                    <div className="mr-auto">
                      <button
                        type="button"
                        disabled={resetDisabledReason !== null}
                        onClick={() => setResetState("confirming")}
                        className="rounded border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {resetState === "submitting"
                          ? "Đang gửi..."
                          : "Đặt lại mật khẩu"}
                      </button>
                      <button
                        type="button"
                        disabled={
                          !selected.active ||
                          selected.id === user?.id ||
                          setPasswordState === "submitting"
                        }
                        onClick={() => {
                          setResetToast("");
                          setSetPasswordState("editing");
                        }}
                        className="ml-2 rounded border border-sky-300 px-3 py-2 text-sm font-semibold text-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Đặt mật khẩu mới
                      </button>
                      {resetDisabledReason && resetState !== "submitting" ? (
                        <p className="mt-1 max-w-xs text-xs text-slate-500">
                          {resetDisabledReason}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      disabled={!canCloseSelectedUser}
                      onClick={closeSelectedUser}
                      className="rounded bg-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Đóng
                    </button>
                    {isAdmin ? (
                      <button
                        type="button"
                        disabled={resetState === "submitting" || savingUser}
                        onClick={saveUser}
                        className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingUser ? "Đang lưu..." : "Lưu thay đổi"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {!isAdmin ? (
                  <p className="mt-3 text-xs text-slate-500">
                    TBT chỉ được xem thông tin; chỉ Admin mới được lưu.
                  </p>
                ) : null}
                {resetState === "confirming" ? (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="password-reset-title"
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
                  >
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                      <h3
                        id="password-reset-title"
                        className="text-lg font-semibold"
                      >
                        Xác nhận đặt lại mật khẩu
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Gửi liên kết đặt lại mật khẩu tới email đã đăng ký của{" "}
                        {selected.full_name}?
                      </p>
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setResetState("idle")}
                          className="rounded bg-slate-200 px-3 py-2 text-sm"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitPasswordReset()}
                          className="rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Gửi liên kết
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {setPasswordState !== "idle" ? (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="admin-set-password-title"
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
                  >
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                      <h3
                        id="admin-set-password-title"
                        className="text-lg font-semibold"
                      >
                        Đặt mật khẩu mới
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Đặt mật khẩu mới cho {selected.full_name}. Các phiên
                        đăng nhập cũ sẽ bị thu hồi.
                      </p>
                      <label className="mt-4 block text-sm">
                        Mật khẩu mới
                        <PasswordInput
                          autoComplete="new-password"
                          disabled={setPasswordState === "submitting"}
                          className="mt-1 w-full rounded border px-3 py-2"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </label>
                      <label className="mt-3 block text-sm">
                        Xác nhận mật khẩu
                        <PasswordInput
                          autoComplete="new-password"
                          disabled={setPasswordState === "submitting"}
                          className="mt-1 w-full rounded border px-3 py-2"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </label>
                      <p className="mt-2 text-xs text-slate-500">
                        {PASSWORD_POLICY_HINT}
                      </p>
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={setPasswordState === "submitting"}
                          onClick={() => {
                            setSetPasswordState("idle");
                            setNewPassword("");
                            setConfirmPassword("");
                          }}
                          className="rounded bg-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          disabled={setPasswordState === "submitting"}
                          onClick={() => void submitAdminSetPassword()}
                          className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {setPasswordState === "submitting"
                            ? "Đang cập nhật..."
                            : "Cập nhật mật khẩu"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
