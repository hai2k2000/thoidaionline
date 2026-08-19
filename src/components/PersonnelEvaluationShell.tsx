"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type UIEvent } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type {
  PersonnelEvaluationData,
} from "@/lib/evaluationRepository";

const reviewLabels: Record<string, string> = {
  self_draft: "Chờ Trưởng phòng chấm bước 1",
  awaiting_manager: "Chờ Trưởng phòng chấm bước 1",
  awaiting_tbt: "Chờ Tổng Biên tập chấm bước 2",
  published: "Đã công bố",
};

const directTbtStatuses = new Set(["awaiting_manager", "awaiting_tbt"]);

export default function PersonnelEvaluationShell({ data, invalidFilters, loadFailed, userLabel, isLeader }: {
  data: PersonnelEvaluationData;
  invalidFilters: boolean;
  loadFailed: boolean;
  userLabel: string;
  isLeader: boolean;
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const [showAdditional, setShowAdditional] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [scoreFilter, setScoreFilter] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(5);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scopedSubjects = data.subjects.filter((person) =>
    (!isLeader || showAdditional || person.isDepartmentManager)
    && (!statusFilter || person.reviewStatus === statusFilter),
  );
  const departments = Array.from(new Map(data.subjects.map((person) => [person.departmentId ?? "", person.departmentName])).entries()).filter(([id]) => id);
  const filteredSubjects = scopedSubjects.filter((person) =>
    (!departmentFilter || person.departmentId === departmentFilter)
    && (!roleFilter || (roleFilter === "manager" ? person.isDepartmentManager : !person.isDepartmentManager))
    && (!scoreFilter || (scoreFilter === "unscored" ? person.managerScore == null && person.finalScore == null : scoreFilter === "manager" ? person.managerScore != null && person.finalScore == null : person.finalScore != null)),
  );
  const visibleSubjects = filteredSubjects.slice(0, visibleLimit);
  const loadMoreOnScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 24) {
      setVisibleLimit((value) => Math.min(value + 5, filteredSubjects.length));
    }
  };
  const onLogout = () => { logout(); router.replace("/login"); };
  const expandTbt = () => { setShowAdditional(true); setVisibleLimit(5); requestAnimationFrame(() => scrollRef.current?.focus()); };
  const reviewLabel = (status: string | null) => {
    if (!status) return "Chưa có hồ sơ";
    if (isLeader && status === "awaiting_manager") return "Tổng Biên tập có thể chấm trực tiếp";
    return reviewLabels[status] ?? status;
  };
  const helperText = isLeader && !showAdditional
    ? `Đang hiển thị ${scopedSubjects.length} trưởng phòng. Bấm “Đánh giá thêm nhân viên” để xem ${data.subjects.length} nhân viên.`
    : `Đang hiển thị ${visibleSubjects.length}/${filteredSubjects.length} nhân viên theo bộ lọc.`;

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row lg:gap-6">
        <AppNav currentPath="/evaluations" userLabel={userLabel} onLogout={onLogout} />
        <main className="min-w-0 flex-1 space-y-4">
      <header className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
            <p className="text-xs font-bold uppercase tracking-wide text-orange-600">ĐÁNH GIÁ NHÂN SỰ</p>
            <h1 className="mt-1 text-2xl font-bold">Nhân viên trực thuộc</h1>
            <p className="mt-1 text-sm text-slate-600">Chọn nhân viên để xem công việc và chấm theo quyền.</p></div>
            <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto sm:flex-nowrap">
              <select value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setVisibleLimit(5); }} aria-label="Lọc phòng ban" className="rounded-lg border bg-white px-2 py-2 text-sm"><option value="">Phòng ban</option>{departments.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select>
              <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setVisibleLimit(5); }} aria-label="Lọc vai trò" className="rounded-lg border bg-white px-2 py-2 text-sm"><option value="">Vai trò</option><option value="manager">Trưởng phòng</option><option value="employee">Nhân viên</option></select>
              <select value={scoreFilter} onChange={(event) => { setScoreFilter(event.target.value); setVisibleLimit(5); }} aria-label="Lọc trạng thái điểm" className="rounded-lg border bg-white px-2 py-2 text-sm"><option value="">Trạng thái điểm</option><option value="unscored">Chưa chấm</option><option value="manager">QL đã chấm</option><option value="complete">Đã chấm đủ</option></select>
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setVisibleLimit(5); }} aria-label="Lọc trạng thái đánh giá" className="rounded-lg border bg-white px-2 py-2 text-sm"><option value="">Trạng thái</option>{Object.keys(reviewLabels).map((value) => <option key={value} value={value}>{reviewLabel(value)}</option>)}</select>
              {isLeader ? <button type="button" onClick={showAdditional ? () => { setShowAdditional(false); setVisibleLimit(5); } : expandTbt} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">{showAdditional ? "Chỉ Trưởng phòng" : `Đánh giá thêm nhân viên (${data.subjects.length})`}</button> : null}
            </div>
          </header>

          <form action="/evaluations" className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-semibold">Ngày bắt đầu<input name="from" type="date" required defaultValue={data.from} className="rounded-lg border px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">Ngày kết thúc<input name="to" type="date" required defaultValue={data.to} className="rounded-lg border px-3 py-2 font-normal" /></label>
            <button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Lọc</button>
            <Link href="/evaluations" className="rounded-lg border px-4 py-2 text-center font-semibold">Đặt lại</Link>
          </form>
          {invalidFilters ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">Khoảng ngày không hợp lệ. Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p> : null}
          {loadFailed ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">Không thể tải dữ liệu đánh giá.</p> : null}

          <section className="overflow-hidden rounded-xl border bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm text-slate-600" role="status">{helperText}</p>
            <div ref={scrollRef} tabIndex={0} onScroll={loadMoreOnScroll} className="max-h-[520px] overflow-auto" aria-label="Danh sách nhân viên, cuộn để xem thêm"><table className="w-full min-w-[860px] border-collapse text-sm">
              <thead><tr className="border-b text-left text-slate-600"><th className="p-2">STT</th><th className="p-2">Nhân viên</th><th className="p-2">Phòng ban</th><th className="p-2">Vai trò</th><th className="p-2">Trạng thái đánh giá</th><th className="p-2">Tổng điểm</th><th className="p-2">Thao tác</th></tr></thead>
              <tbody>{visibleSubjects.map((person, index) => {
                const detailHref = `/evaluations/${person.employeeId}?from=${data.from}&to=${data.to}`;
                const canScoreDirectly = isLeader && person.reviewStatus != null && directTbtStatuses.has(person.reviewStatus);
                return <tr key={person.employeeId} className="border-b"><td className="p-2">{index + 1}</td><td className="p-2 font-semibold"><Link className="text-orange-700 underline" target="_blank" rel="noopener noreferrer" href={detailHref}>{person.employeeName}</Link></td><td className="p-2">{person.departmentName}</td><td className="p-2">{person.isDepartmentManager ? "Trưởng phòng" : "Nhân viên"}</td><td className="p-2">{reviewLabel(person.reviewStatus)}</td><td className="p-2 font-semibold">{person.finalScore ?? person.managerScore ?? "—"}</td><td className="p-2"><Link className={canScoreDirectly ? "inline-flex rounded-lg bg-orange-600 px-3 py-2 font-semibold text-white" : "inline-flex rounded-lg border px-3 py-2 font-semibold text-slate-700"} target="_blank" rel="noopener noreferrer" href={detailHref}>{canScoreDirectly ? "Chấm trực tiếp" : "Xem chi tiết"}</Link></td></tr>;
              })}</tbody>
            </table>{visibleLimit < filteredSubjects.length ? <div className="sticky bottom-0 flex justify-center bg-white/95 p-2"><button type="button" onClick={() => setVisibleLimit((value) => Math.min(value + 5, filteredSubjects.length))} className="rounded border px-3 py-2 text-sm font-semibold">Xem thêm 5 nhân viên</button></div> : null}</div>
            {!filteredSubjects.length && !invalidFilters && !loadFailed ? <p className="p-6 text-center text-slate-500">Không có nhân viên phù hợp bộ lọc.</p> : null}
          </section>
        </main>
      </div>
    </div>
  );
}
