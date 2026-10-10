"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { filterAssetList, isAssetUnassigned, summarizeAssetList, type AssetQuickFilter } from "@/lib/assetListPresentation";
import { listAssets, type Asset } from "@/lib/services";

type AssetRow = Asset & {
  assigned_department_name?: string | null;
  assignee_name?: string | null;
  department_name?: string | null;
};
type DepartmentOption = { id: string; name: string };
type UserOption = { id: string; full_name: string; department_id: string | null };

const assetStatusLabel: Record<string, string> = {
  available: "Sẵn sàng",
  in_use: "Đang sử dụng",
  maintenance: "Bảo trì",
  broken: "Hỏng",
  liquidated: "Thanh lý",
};

const quickFilters: { value: AssetQuickFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "in_use", label: "Đang sử dụng" },
  { value: "unassigned", label: "Chưa phân công" },
  { value: "lot", label: "Theo lô" },
];

const statusTone: Record<string, string> = {
  available: "border-slate-200 bg-slate-100 text-slate-700",
  in_use: "border-emerald-200 bg-emerald-50 text-emerald-800",
  maintenance: "border-amber-200 bg-amber-50 text-amber-800",
  broken: "border-rose-200 bg-rose-50 text-rose-800",
  liquidated: "border-slate-300 bg-white text-slate-600",
};

function StatusBadge({ row }: { row: AssetRow }) {
  const showUnassigned = row.status === "available" && isAssetUnassigned(row);
  const label = showUnassigned ? "Chưa phân công" : assetStatusLabel[row.status ?? "available"] ?? (row.status ?? "-");
  const tone = showUnassigned ? "border-amber-200 bg-amber-50 text-amber-900" : statusTone[row.status ?? "available"] ?? statusTone.available;
  return <span className={`inline-flex min-h-7 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
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
  const [qCategory, setQCategory] = useState("");
  const [qStatus, setQStatus] = useState("");
  const [quickFilter, setQuickFilter] = useState<AssetQuickFilter>("all");

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

  const filteredRows = useMemo(
    () => filterAssetList(rows, { name: qName, category: qCategory, status: qStatus, quick: quickFilter }),
    [rows, qName, qCategory, qStatus, quickFilter],
  );
  const summary = useMemo(() => summarizeAssetList(rows), [rows]);
  const departmentById = useMemo(() => new Map(departments.map((department) => [department.id, department.name])), [departments]);
  const userById = useMemo(() => new Map(users.map((person) => [person.id, person.full_name])), [users]);

  const custody = (row: AssetRow) => {
    const assignment = row.currentAssignment;
    if (!assignment) return { department: "Chưa xác định phòng", person: "Cần bổ sung sau", unassigned: true };
    const labeledRow = row as AssetRow & { assigned_to_label?: string | null };
    const department = labeledRow.assigned_department_name ?? labeledRow.department_name ?? departmentById.get(assignment.department_id ?? "") ?? "Phòng đã phân công";
    const person = labeledRow.assignee_name ?? labeledRow.assigned_to_label ?? (assignment.assignee_id ? userById.get(assignment.assignee_id) ?? "Người sử dụng đã phân công" : "Tài sản dùng chung");
    return { department, person, unassigned: false };
  };

  const clearFilters = () => {
    setQName("");
    setQCategory("");
    setQStatus("");
    setQuickFilter("all");
  };

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

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(240px,1.4fr)_minmax(150px,0.8fr)_minmax(170px,0.8fr)_auto] md:items-end">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Tên tài sản</span><input className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" placeholder="Tìm tên tài sản..." value={qName} onChange={(event) => setQName(event.target.value)} /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Nhóm</span><input className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" placeholder="CCDC, TSC, MMTB..." value={qCategory} onChange={(event) => setQCategory(event.target.value)} /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Tình trạng</span><select className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" value={qStatus} onChange={(event) => setQStatus(event.target.value)}><option value="">Tất cả tình trạng</option><option value="in_use">{assetStatusLabel.in_use}</option><option value="available">Chưa phân công / Sẵn sàng</option><option value="maintenance">{assetStatusLabel.maintenance}</option><option value="broken">{assetStatusLabel.broken}</option><option value="liquidated">{assetStatusLabel.liquidated}</option></select></label>
              <button type="button" onClick={clearFilters} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-300">Xóa lọc</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Bộ lọc nhanh">
              {quickFilters.map((filter) => <button key={filter.value} type="button" aria-pressed={quickFilter === filter.value} onClick={() => setQuickFilter(filter.value)} className={`min-h-10 rounded-full border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-300 ${quickFilter === filter.value ? "border-orange-300 bg-orange-50 text-orange-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{filter.label}</button>)}
            </div>
            {message ? <p role={loaded ? "alert" : "status"} className={`mt-3 text-sm ${loaded ? "text-rose-700" : "text-slate-600"}`}>{message}</p> : null}
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{filteredRows.length === summary.total ? `${summary.total} tài sản` : `Hiển thị ${filteredRows.length} / ${summary.total} tài sản`}</p>
              <p className="hidden text-xs text-slate-500 md:block">Cuộn ngang để xem đầy đủ các cột</p>
            </div>

            <div className="hidden md:block">
              <div className="table-scroll max-h-[72vh] rounded-xl border border-slate-200" tabIndex={0} aria-label="Danh sách tài sản, cuộn ngang để xem thêm">
                <table className="data-table min-w-[1220px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                    <tr>
                      <th scope="col" className="min-w-[260px] whitespace-nowrap border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide">Tài sản</th>
                      <th scope="col" className="min-w-[100px] whitespace-nowrap border-b border-slate-200 px-3 py-3 text-xs font-semibold uppercase tracking-wide">Nhóm</th>
                      <th scope="col" className="min-w-[110px] whitespace-nowrap border-b border-slate-200 px-3 py-3 text-xs font-semibold uppercase tracking-wide">Theo dõi</th>
                      <th scope="col" className="min-w-[80px] whitespace-nowrap border-b border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide">Số lượng</th>
                      <th scope="col" className="min-w-[130px] whitespace-nowrap border-b border-slate-200 px-3 py-3 text-xs font-semibold uppercase tracking-wide">Tình trạng</th>
                      <th scope="col" className="min-w-[240px] whitespace-nowrap border-b border-slate-200 px-3 py-3 text-xs font-semibold uppercase tracking-wide">Phòng / Người sử dụng</th>
                      <th scope="col" className="min-w-[220px] whitespace-nowrap border-b border-slate-200 px-3 py-3 text-xs font-semibold uppercase tracking-wide">Ghi chú</th>
                      <th scope="col" className="min-w-[110px] whitespace-nowrap border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row) => {
                      const owner = custody(row);
                      return <tr key={row.id ?? row.asset_code} className="h-[72px] transition-colors hover:bg-slate-50/90">
                        <td className="min-w-[260px] px-4 py-3"><p className="line-clamp-2 font-semibold leading-5 text-slate-950" title={row.asset_name}>{row.asset_name}</p>{row.asset_code ? <p className="mt-1 text-xs font-medium text-slate-500">{row.asset_code}</p> : null}</td>
                        <td className="min-w-[100px] px-3 py-3"><MetadataBadge>{row.category || "Chưa rõ"}</MetadataBadge></td>
                        <td className="min-w-[110px] px-3 py-3"><MetadataBadge tone={row.tracking_mode === "lot" ? "sky" : "slate"}>{row.tracking_mode === "lot" ? "Theo lô" : "Cá thể"}</MetadataBadge></td>
                        <td className="min-w-[80px] px-3 py-3 text-center text-base font-bold tabular-nums text-slate-900">{row.quantity ?? 1}</td>
                        <td className="min-w-[130px] px-3 py-3"><StatusBadge row={row} /></td>
                        <td className="min-w-[240px] px-3 py-3"><p className={`font-medium ${owner.unassigned ? "text-amber-900" : "text-slate-900"}`}>{owner.department}</p><p className={`mt-1 text-xs ${owner.unassigned ? "font-medium text-amber-700" : "text-slate-500"}`}>{owner.person}</p></td>
                        <td className="min-w-[220px] px-3 py-3"><p className="line-clamp-2 leading-5 text-slate-600" title={row.note ?? undefined}>{row.note || "—"}</p></td>
                        <td className="min-w-[110px] px-4 py-3 text-right"><Link href={`/assets/${row.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-300">Chi tiết <span aria-hidden="true" className="ml-1">→</span></Link></td>
                      </tr>;
                    })}
                    {loaded && !message && filteredRows.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">Không có tài sản phù hợp bộ lọc.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 md:hidden">
              {filteredRows.map((row) => {
                const owner = custody(row);
                return <article key={row.id ?? row.asset_code} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold leading-5 text-slate-950">{row.asset_name}</h2>{row.asset_code ? <p className="mt-1 text-xs font-medium text-slate-500">{row.asset_code}</p> : null}</div><StatusBadge row={row} /></div>
                  <div className="mt-3 flex flex-wrap gap-2"><MetadataBadge>{row.category || "Chưa rõ"}</MetadataBadge><MetadataBadge tone={row.tracking_mode === "lot" ? "sky" : "slate"}>{row.tracking_mode === "lot" ? "Theo lô" : "Cá thể"}</MetadataBadge><MetadataBadge>SL: {row.quantity ?? 1}</MetadataBadge></div>
                  <dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phòng</dt><dd className={`mt-1 font-medium ${owner.unassigned ? "text-amber-900" : "text-slate-900"}`}>{owner.department}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Người sử dụng</dt><dd className={`mt-1 ${owner.unassigned ? "font-medium text-amber-700" : "text-slate-600"}`}>{owner.person}</dd></div>{row.note ? <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ghi chú</dt><dd className="mt-1 line-clamp-2 leading-5 text-slate-600" title={row.note}>{row.note}</dd></div> : null}</dl>
                  <div className="mt-4 border-t border-slate-100 pt-3 text-right"><Link href={`/assets/${row.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300">Chi tiết <span aria-hidden="true" className="ml-1">→</span></Link></div>
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
