"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { filterAssetList, isAssetUnassigned, presentAssetCustody, summarizeAssetList, normalizeVietnamese, type AssetQuickFilter } from "@/lib/assetListPresentation";
import { presentAssetCondition } from "@/lib/assetStatusPresentation";
import { listAssets, type Asset } from "@/lib/services";

type AssetRow = Asset & {
  assigned_department_name?: string | null;
  assignee_name?: string | null;
};
type DepartmentOption = { id: string; name: string };
type UserOption = { id: string; full_name: string; department_id: string | null };

const quickFilters: { value: AssetQuickFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "in_use", label: "Đang sử dụng" },
  { value: "unassigned", label: "Chưa phân công" },
  { value: "needs_maintenance", label: "Cần bảo trì" },
  { value: "broken", label: "Hỏng" },
];

const statusTone: Record<string, string> = {
  available: "border-slate-200 bg-slate-100 text-slate-700",
  in_use: "border-emerald-200 bg-emerald-50 text-emerald-800",
  maintenance: "border-amber-200 bg-amber-50 text-amber-800",
  broken: "border-rose-200 bg-rose-50 text-rose-800",
  liquidated: "border-slate-300 bg-white text-slate-600",
};

function StatusBadge({ row }: { row: AssetRow }) {
  if (row.status === "liquidated") return <span className="inline-flex min-h-7 items-center whitespace-nowrap rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Đã thanh lý</span>;
  const showUnassigned = isAssetUnassigned(row);
  const label = showUnassigned ? "Chưa phân công" : "Đang sử dụng";
  const tone = showUnassigned ? "border-amber-200 bg-amber-50 text-amber-900" : statusTone.in_use;
  return <span className={`inline-flex min-h-7 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function ConditionBadge({ row }: { row: AssetRow }) {
  const condition = row.condition_status ?? (row.status === "maintenance" ? "needs_maintenance" : row.status === "broken" ? "broken" : "normal");
  const tone = condition === "broken" ? "border-rose-200 bg-rose-50 text-rose-800" : condition === "needs_maintenance" || condition === "under_service" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return <span className={`inline-flex min-h-7 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{presentAssetCondition(condition)}</span>;
}

function MetadataBadge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "sky" }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ${tone === "sky" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>{children}</span>;
}

export default function AssetsPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, hasPermission } = useAuth();

  const [rows, setRows] = useState<AssetRow[]>([]);
  const [message, setMessage] = useState("Đang tải danh sách tài sản...");
  const [loaded, setLoaded] = useState(false);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [qName, setQName] = useState("");
  const [qDepartment, setQDepartment] = useState("");
  const [qCondition, setQCondition] = useState("");
  const [qUsage, setQUsage] = useState("");
  const [quickFilter, setQuickFilter] = useState<AssetQuickFilter>("all");
  const [qAssignee, setQAssignee] = useState("");
  const [qEmployeeSearch, setQEmployeeSearch] = useState("");
  const [employeeActiveIndex, setEmployeeActiveIndex] = useState(0);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const employeeFilterRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    const assetsRes = await listAssets();
    if (!assetsRes.ok) {
      setLoaded(true);
      return setMessage(assetsRes.error);
    }

    setRows(assetsRes.data as AssetRow[]);
    setMessage("");
    setLoaded(true);

    if (hasPermission("asset.manage")) {
      const response = await fetch("/api/assets?options=1", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { departments?: DepartmentOption[]; users?: UserOption[] } | null;
      if (response.ok) {
        setDepartments(payload?.departments ?? []);
        setUsers(payload?.users ?? []);
      }
    }
  }, [hasPermission]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!hasPermission("asset.view") && !hasPermission("asset.manage")) return void router.push("/");
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [authLoading, user, router, hasPermission, loadData]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!employeeFilterRef.current?.contains(event.target as Node)) setEmployeeOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const filteredRows = useMemo(
    () => filterAssetList(rows, { name: qName, category: "", conditionStatus: qCondition, usageState: qUsage as "assigned" | "unassigned" | "liquidated" | "", quick: quickFilter, departmentId: qDepartment, assigneeId: qAssignee }),
    [rows, qName, qCondition, qUsage, quickFilter, qAssignee, qDepartment],
  );
  const summary = useMemo(() => summarizeAssetList(rows), [rows]);
  const departmentById = useMemo(() => new Map(departments.map((department) => [department.id, department.name])), [departments]);
  const userById = useMemo(() => new Map(users.map((person) => [person.id, person.full_name])), [users]);

  const custody = (row: AssetRow) => {
    const assignment = row.currentAssignment;
    return presentAssetCustody({
      ...row,
      assigned_department_name: row.assigned_department_name ?? (assignment?.department_id ? departmentById.get(assignment.department_id) ?? null : null),
      assignee_name: row.assignee_name ?? (assignment?.assignee_id ? userById.get(assignment.assignee_id) ?? null : null),
    });
  };

  const clearFilters = () => {
    setQName("");
    setQDepartment("");
    setQCondition("");
    setQUsage("");
    setQuickFilter("all");
    setQAssignee("");
    setQEmployeeSearch("");
    setEmployeeOpen(false);
    setEmployeeActiveIndex(0);
  };

  const hasActiveFilters = Boolean(qName || qDepartment || qCondition || qUsage || qAssignee || quickFilter !== "all");

  return (
    <main className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/assets" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div className="min-w-0">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">Quản lý tài sản</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Danh sách tài sản</h1>
            </div>
            {loaded && !message ? <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">{summary.total} tài sản</span><span className="mx-2 text-slate-300">·</span>{summary.assigned} đã phân công<span className="mx-2 text-slate-300">·</span><span className="font-semibold text-amber-800">{summary.unassigned} chưa phân công</span></p> : null}
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3"><div><p className="text-sm font-bold tracking-tight text-slate-900">Bộ lọc danh sách</p><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Thu hẹp danh sách theo tài sản, đơn vị, người sử dụng và tình trạng.</p></div><button type="button" onClick={clearFilters} aria-label="Xóa tất cả bộ lọc" className={`min-h-9 rounded-lg px-2.5 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-orange-300 ${hasActiveFilters ? "text-orange-700 hover:bg-orange-50 hover:text-orange-900" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}>Xóa lọc</button></div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-slate-700"><span>Tên tài sản</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" placeholder="Tìm tên tài sản..." value={qName} onChange={(event) => setQName(event.target.value)} /></label>
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-slate-700"><span>Phòng ban</span><select className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" value={qDepartment} onChange={(event) => { setQDepartment(event.target.value); setQAssignee(""); setQEmployeeSearch(""); setEmployeeActiveIndex(0); setEmployeeOpen(false); }}><option value="">Tất cả phòng ban</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
              <div ref={employeeFilterRef} className="relative grid min-w-0 gap-1.5 text-sm font-semibold text-slate-700">
                <span>Nhân viên</span>
                {qAssignee === "__shared" ? <button type="button" aria-label="Xóa lọc tài sản dùng chung của phòng" onClick={() => { setQAssignee(""); setQEmployeeSearch(""); setEmployeeOpen(false); }} className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 text-left text-sm font-semibold text-orange-900 focus:outline-none focus:ring-2 focus:ring-orange-200"><span className="truncate">Dùng chung của phòng</span><span aria-hidden="true" className="text-base">×</span></button> : <input role="combobox" aria-controls="employee-filter-options" aria-expanded={employeeOpen} disabled={!qDepartment} className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" placeholder={qDepartment ? "Tìm nhân viên..." : "Chọn phòng trước"} value={qAssignee ? (users.find((person) => person.id === qAssignee)?.full_name ?? "") : qEmployeeSearch} onFocus={() => { if (qDepartment) setEmployeeOpen(true); }} onChange={(event) => { setQAssignee(""); setQEmployeeSearch(event.target.value); setEmployeeActiveIndex(0); setEmployeeOpen(true); }} onKeyDown={(event) => { const matches = users.filter((person) => person.department_id === qDepartment && normalizeVietnamese(person.full_name).includes(normalizeVietnamese(qEmployeeSearch))).slice(0, 8); if (event.key === "Escape") { event.preventDefault(); setEmployeeOpen(false); } if (event.key === "ArrowDown") { event.preventDefault(); setEmployeeOpen(true); setEmployeeActiveIndex((index) => Math.min(index + 1, Math.max(matches.length - 1, 0))); } if (event.key === "ArrowUp") { event.preventDefault(); setEmployeeOpen(true); setEmployeeActiveIndex((index) => Math.max(index - 1, 0)); } if (event.key === "Enter") { const match = matches[employeeActiveIndex] ?? matches[0]; if (match) { setQAssignee(match.id); setQEmployeeSearch(""); setEmployeeOpen(false); } } }} />}
                {qDepartment && employeeOpen && qAssignee !== "__shared" ? <div id="employee-filter-options" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"><button type="button" role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => { setQAssignee("__shared"); setQEmployeeSearch(""); setEmployeeOpen(false); setEmployeeActiveIndex(0); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-orange-800 hover:bg-orange-50">Tài sản dùng chung của phòng</button>{users.filter((person) => person.department_id === qDepartment && normalizeVietnamese(person.full_name).includes(normalizeVietnamese(qEmployeeSearch))).slice(0, 8).map((person, index) => <button type="button" role="option" aria-selected={index === employeeActiveIndex} key={person.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setQAssignee(person.id); setQEmployeeSearch(""); setEmployeeOpen(false); }} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${index === employeeActiveIndex ? "bg-orange-50 text-orange-950" : "hover:bg-slate-50"}`}>{person.full_name}</button>)}</div> : null}
                {qDepartment ? <button type="button" aria-pressed={qAssignee === "__shared"} onClick={() => { setQAssignee(qAssignee === "__shared" ? "" : "__shared"); setQEmployeeSearch(""); setEmployeeOpen(false); setEmployeeActiveIndex(0); }} className={`min-h-7 self-start rounded-md px-1 text-left text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-orange-200 ${qAssignee === "__shared" ? "text-orange-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}>Tài sản dùng chung của phòng</button> : <span className="min-h-7 text-xs font-medium text-slate-400">Chọn phòng để lọc theo nhân viên</span>}
              </div>
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-slate-700"><span>Trạng thái sử dụng</span><select className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" value={qUsage} onChange={(event) => setQUsage(event.target.value)}><option value="">Tất cả</option><option value="assigned">Đang sử dụng</option><option value="unassigned">Chưa phân công</option><option value="liquidated">Đã thanh lý</option></select></label>
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-slate-700"><span>Tình trạng</span><select className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" value={qCondition} onChange={(event) => setQCondition(event.target.value)}><option value="">Tất cả tình trạng</option><option value="normal">Bình thường</option><option value="needs_maintenance">Cần bảo trì</option><option value="under_service">Đang sửa chữa</option><option value="broken">Hỏng</option></select></label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3" aria-label="Bộ lọc nhanh"><span className="mr-1 text-xs font-bold uppercase tracking-wide text-slate-400">Lọc nhanh</span>{quickFilters.map((filter) => <button key={filter.value} type="button" aria-pressed={quickFilter === filter.value} onClick={() => setQuickFilter(filter.value)} className={`min-h-9 rounded-full border px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-300 ${quickFilter === filter.value ? "border-orange-300 bg-orange-50 text-orange-900" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>{filter.label}</button>)}</div>
            {message ? <p role={loaded ? "alert" : "status"} className={`mt-3 text-sm ${loaded ? "text-rose-700" : "text-slate-600"}`}>{message}</p> : null}
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{filteredRows.length === summary.total ? `${summary.total} tài sản` : `Hiển thị ${filteredRows.length} / ${summary.total} tài sản`}</p>
            </div>

            <div className="hidden md:block">
              <div className="table-scroll max-h-[72vh] rounded-xl border border-slate-200" tabIndex={0} aria-label="Danh sách tài sản; có thể cuộn ngang trên màn hình hẹp">
                <table className="data-table table-fixed min-w-[900px] text-left text-sm">
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[68px]" />
                    <col className="w-[140px]" />
                    <col className="w-[124px]" />
                    <col className="w-[20%]" />
                    <col className="min-w-[170px]" />
                    <col className="w-[92px]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                    <tr>
                      <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide">Tài sản</th>
                      <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide">Số lượng</th>
                      <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-xs font-semibold uppercase tracking-wide">Trạng thái sử dụng</th>
                      <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-xs font-semibold uppercase tracking-wide">Tình trạng</th>
                      <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-xs font-semibold uppercase tracking-wide">Người sử dụng</th>
                      <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-xs font-semibold uppercase tracking-wide">Ghi chú</th>
                      <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row) => {
                      const owner = custody(row);
                      return <tr key={row.id ?? row.asset_code} className="h-[72px] transition-colors hover:bg-slate-50/90">
                        <td className="px-4 py-3"><p className="line-clamp-2 break-words font-semibold leading-5 text-slate-950" title={row.asset_name}>{row.asset_name}</p>{row.asset_code ? <p className="mt-1 text-xs font-medium text-slate-500">{row.asset_code}</p> : null}</td>
                        <td className="px-2 py-3 text-center text-base font-bold tabular-nums text-slate-900">{row.quantity ?? 1}</td>
                        <td className="px-3 py-3"><StatusBadge row={row} /></td>
                        <td className="px-3 py-3"><ConditionBadge row={row} /></td>
                        <td className="px-3 py-3"><p className={`break-words font-medium leading-5 ${owner.unassigned ? "text-amber-900" : "text-slate-900"}`}>{owner.person}</p></td>
                        <td className="px-3 py-3"><p className="line-clamp-2 break-words leading-5 text-slate-600" title={row.note ?? undefined}>{row.note || "—"}</p></td>
                        <td className="px-3 py-3 text-right"><Link href={`/assets/${row.id}`} className="inline-flex min-h-10 items-center whitespace-nowrap rounded-md px-2.5 py-2 text-xs font-bold text-slate-500 transition hover:bg-orange-50 hover:text-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-300">Xem <span aria-hidden="true" className="ml-1 text-orange-600">›</span></Link></td>
                      </tr>;
                    })}
                    {loaded && !message && filteredRows.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">Không có tài sản phù hợp bộ lọc.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 md:hidden">
              {filteredRows.map((row) => {
                const owner = custody(row);
                return <article key={row.id ?? row.asset_code} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold leading-5 text-slate-950">{row.asset_name}</h2>{row.asset_code ? <p className="mt-1 text-xs font-medium text-slate-500">{row.asset_code}</p> : null}</div><div className="flex flex-wrap justify-end gap-1"><StatusBadge row={row} /><ConditionBadge row={row} /></div></div>
                  <div className="mt-3 flex flex-wrap gap-2"><MetadataBadge>{row.category || "Chưa rõ"}</MetadataBadge><MetadataBadge tone={row.tracking_mode === "lot" ? "sky" : "slate"}>{row.tracking_mode === "lot" ? "Theo lô" : "Cá thể"}</MetadataBadge><MetadataBadge>SL: {row.quantity ?? 1}</MetadataBadge></div>
                  <dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Người sử dụng</dt><dd className={`mt-1 ${owner.unassigned ? "font-medium text-amber-700" : "text-slate-600"}`}>{owner.person}</dd></div>{row.note ? <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ghi chú</dt><dd className="mt-1 line-clamp-2 leading-5 text-slate-600" title={row.note}>{row.note}</dd></div> : null}</dl>
                  <div className="mt-4 border-t border-slate-100 pt-3 text-right"><Link href={`/assets/${row.id}`} className="inline-flex min-h-11 items-center rounded-md px-2.5 py-2 text-sm font-bold text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-300 hover:bg-orange-50 hover:text-orange-800">Xem <span aria-hidden="true" className="ml-1 text-orange-600">›</span></Link></div>
                </article>;
              })}
              {loaded && !message && filteredRows.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Không có tài sản phù hợp bộ lọc.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
