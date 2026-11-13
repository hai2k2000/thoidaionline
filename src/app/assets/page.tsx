"use client";

import { ASSET_COLUMNS, ASSET_SHEET, TRACKING_MODES, CONDITIONS, parseAssetSheet, type ExcelRow, type ExcelError } from "@/lib/assetExcelSpec.mjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import MobileFilters from "@/components/MobileFilters";
import AppNav from "@/components/AppNav";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import { useAuth } from "@/lib/auth";
import { filterAssetList, isAssetInWarehouse, isAssetUnassigned, presentAssetCustody, summarizeAssetList, normalizeVietnamese, type AssetQuickFilter } from "@/lib/assetListPresentation";
import { presentAssetCondition } from "@/lib/assetStatusPresentation";
import { listAssets, type Asset } from "@/lib/services";
import { ASSET_LIST_VIEW_STORAGE_KEY, defaultAssetListViewState, parseAssetListViewState, serializeAssetListViewState } from "@/lib/assetListViewState.mjs";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";

type AssetRow = Asset & {
  assigned_department_name?: string | null;
  assignee_name?: string | null;
};
type DepartmentOption = { id: string; name: string };
type LocationOption = { id: string; code: string; name: string };
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
  const { notify } = useActionFeedback();
  const { loading: authLoading, user, logout, hasPermission } = useAuth();

  const [excelBusy, setExcelBusy] = useState(false);
  const [excelNotice, setExcelNotice] = useState("");
  const [importRows, setImportRows] = useState<ExcelRow[]>([]);
  const [importErrors, setImportErrors] = useState<ExcelError[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [validated, setValidated] = useState(false);
  const [excelOptionsLoaded, setExcelOptionsLoaded] = useState(false);
  const importDialog = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [message, setMessage] = useState("Đang tải danh sách tài sản…");
  const [loaded, setLoaded] = useState(false);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const initialViewState = useRef<ReturnType<typeof defaultAssetListViewState> | null>(null);
  const scrollRestored = useRef(false);
  const suppressFilterSave = useRef(false);
  const readViewState = () => {
    if (initialViewState.current) return initialViewState.current;
    if (typeof window === "undefined") return defaultAssetListViewState();
    try { initialViewState.current = parseAssetListViewState(window.sessionStorage.getItem(ASSET_LIST_VIEW_STORAGE_KEY)); } catch { initialViewState.current = defaultAssetListViewState(); }
    return initialViewState.current;
  };
  const [qName, setQName] = useState("");
  const [qDepartment, setQDepartment] = useState("");
  const [qLocation, setQLocation] = useState("");
  const [qCondition, setQCondition] = useState("");
  const [qUsage, setQUsage] = useState("");
  const [quickFilter, setQuickFilter] = useState<AssetQuickFilter>("all");
  const [qAssignee, setQAssignee] = useState("");
  const [qEmployeeSearch, setQEmployeeSearch] = useState("");
  const [employeeActiveIndex, setEmployeeActiveIndex] = useState(0);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const employeeFilterRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Restore saved filters after mount so server and first client render match.
    const timer = setTimeout(() => {
      const state = readViewState();
      setQName(state.qName); setQDepartment(state.qDepartment); setQLocation(state.qLocation); setQCondition(state.qCondition); setQUsage(state.qUsage); setQuickFilter(state.quickFilter as AssetQuickFilter); setQAssignee(state.qAssignee);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const saveViewState = useCallback(() => {
    if (typeof window === "undefined") return;
    const state = { qName, qDepartment, qLocation, qCondition, qUsage, quickFilter, qAssignee, windowScrollY: window.scrollY, tableScrollTop: tableScrollRef.current?.scrollTop ?? 0, tableScrollLeft: tableScrollRef.current?.scrollLeft ?? 0 };
    try { window.sessionStorage.setItem(ASSET_LIST_VIEW_STORAGE_KEY, serializeAssetListViewState(state)); } catch { /* storage is optional */ }
  }, [qName, qDepartment, qLocation, qCondition, qUsage, quickFilter, qAssignee]);

  useEffect(() => {
    if (!loaded || !scrollRestored.current) return;
    if (suppressFilterSave.current) { suppressFilterSave.current = false; return; }
    saveViewState();
  }, [loaded, saveViewState]);

  const loadData = useCallback(async () => {
    const assetsRes = await listAssets();
    if (!assetsRes.ok) {
      setLoaded(true);
      return setMessage(assetsRes.error);
    }

    setRows(assetsRes.data as AssetRow[]);
    setMessage("");
    setLoaded(true);

    const canManage = hasPermission("asset.manage");
    const response = await fetch(canManage ? "/api/assets?options=1" : "/api/assets", { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { departments?: DepartmentOption[]; users?: UserOption[]; locations?: LocationOption[] } | null;
    if (response.ok) {
      setLocations(payload?.locations ?? []);
      if (canManage) {
        setDepartments(payload?.departments ?? []);
        setUsers(payload?.users ?? []);
      }
      setExcelOptionsLoaded(true);
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

  useEffect(() => {
    if (!loaded || scrollRestored.current) return;
    const state = readViewState();
    requestAnimationFrame(() => {
      try {
        window.scrollTo(0, state.windowScrollY);
        if (tableScrollRef.current) { tableScrollRef.current.scrollTop = state.tableScrollTop; tableScrollRef.current.scrollLeft = state.tableScrollLeft; }
      } catch { /* scroll restoration is best effort */ }
      scrollRestored.current = true;
    });
  }, [loaded]);

  const warehouseLocationIds = useMemo(() => new Set(locations.filter((location) => location.code === "kho" || location.code === "kho_cho_xu_ly").map((location) => location.id)), [locations]);
  const filteredRows = useMemo(
    () => filterAssetList(rows, { name: qName, category: "", conditionStatus: qCondition, usageState: qUsage as "assigned" | "unassigned" | "liquidated" | "", quick: quickFilter, departmentId: qDepartment, assigneeId: qAssignee, locationId: qLocation, warehouseLocationIds }),
    [rows, qName, qCondition, qUsage, quickFilter, qAssignee, qDepartment, qLocation, warehouseLocationIds],
  );
  const summary = useMemo(() => summarizeAssetList(rows.filter((row) => !isAssetInWarehouse(row, warehouseLocationIds) || warehouseLocationIds.has(qLocation))), [rows, qLocation, warehouseLocationIds]);
  const departmentById = useMemo(() => new Map(departments.map((department) => [department.id, department.name])), [departments]);
  const userById = useMemo(() => new Map(users.map((person) => [person.id, person.full_name])), [users]);
  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location.name])), [locations]);

  const locationLabel = (row: AssetRow) => row.location_id ? locationById.get(row.location_id) ?? "Vị trí đã lưu" : "Chưa cập nhật";

  const custody = (row: AssetRow) => {
    const assignment = row.currentAssignment;
    return presentAssetCustody({
      ...row,
      assigned_department_name: row.assigned_department_name ?? (assignment?.department_id ? departmentById.get(assignment.department_id) ?? null : null),
      assignee_name: row.assignee_name ?? (assignment?.assignee_id ? userById.get(assignment.assignee_id) ?? null : null),
    });
  };

  const clearFilters = () => {
    suppressFilterSave.current = true;
    setQName("");
    setQDepartment("");
    setQLocation("");
    setQCondition("");
    setQUsage("");
    setQuickFilter("all");
    setQAssignee("");
    setQEmployeeSearch("");
    setEmployeeOpen(false);
    setEmployeeActiveIndex(0);
    try { window.sessionStorage.removeItem(ASSET_LIST_VIEW_STORAGE_KEY); } catch { /* storage is optional */ }
  };

  const openAsset = (id?: string) => { saveViewState(); if (id) router.push(`/assets/${id}`); };

  const downloadExcel = async (template: boolean) => {
    setExcelBusy(true); setExcelNotice("");
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(ASSET_SHEET);
      sheet.columns = [...ASSET_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width })), ...(!template ? [{ header: "Trạng thái sử dụng", key: "usage", width: 22 }, { header: "Ngày cấp phát", key: "assigned_at", width: 25 }] : [])];
      sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.getRow(1).font = { bold: true };
      if (template) {
        const person = users.find(u => departments.some(d => d.id === u.department_id));
        const room = departments.find(d => d.id === person?.department_id);
        sheet.addRow({ asset_name: "Máy in dùng chung", category: "Thiết bị văn phòng", tracking_mode: "Cá thể", quantity: 1, department: departments[0]?.name ?? "Phòng mẫu (thay bằng phòng thực tế)", location: locations[0]?.name ?? "", condition_status: "Bình thường" });
        sheet.addRow({ asset_name: "Bộ bàn ghế", category: "Nội thất", tracking_mode: "Theo lô", quantity: 5, department: room?.name ?? departments[0]?.name ?? "Phòng mẫu (thay bằng phòng thực tế)", assignee: person?.full_name ?? "Nhân viên mẫu (thay bằng người thực tế)", location: locations[0]?.name ?? "", condition_status: "Bình thường" });
        const guide = workbook.addWorksheet("Hướng dẫn");
        guide.columns = [{ header: "Cột", width: 28 }, { header: "Hướng dẫn", width: 110 }, { header: "Phòng đang hoạt động", width: 35 }, { header: "Vị trí đang hoạt động", width: 35 }];
        guide.getRow(1).font = { bold: true };
        ASSET_COLUMNS.forEach(c => guide.addRow([c.header, c.help]));
        guide.addRow(["Hình thức theo dõi", Object.values(TRACKING_MODES).join(" / ")]);
        guide.addRow(["Tình trạng", Object.values(CONDITIONS).join(" / ")]);
        guide.addRow(["Lưu ý", "Thay hoặc xóa 2 dòng ví dụ trước khi nhập. Tối đa 1000 dòng. Mã đã tồn tại sẽ bị từ chối. Các cột trạng thái sử dụng/ngày cấp phát chỉ để tham khảo, không được nhập lại."]);
        departments.forEach((d, i) => { guide.getCell(i + 2, 3).value = d.name; });
        locations.forEach((l, i) => { guide.getCell(i + 2, 4).value = l.name; });
        for (let r = 2; r <= 1001; r++) {
          for (const [column, labels] of [[4, Object.values(TRACKING_MODES)], [9, Object.values(CONDITIONS)]] as const) sheet.getCell(r, column).dataValidation = { type: "list", allowBlank: true, formulae: ['"' + labels.join(",") + '"'], showErrorMessage: true, errorTitle: "Giá trị không hợp lệ", error: "Vui lòng chọn giá trị trong danh sách." };
          for (const [column, letter, count] of [[6, "C", departments.length], [8, "D", locations.length]] as const) if (count) sheet.getCell(r, column).dataValidation = { type: "list", allowBlank: true, formulae: [`'Hướng dẫn'!$${letter}$2:$${letter}$${count + 1}`] };
        }
      } else {
        filteredRows.map(row => {
          const assignment = row.currentAssignment;
          return sheet.addRow({ asset_code: row.asset_code, asset_name: row.asset_name, category: row.category, tracking_mode: TRACKING_MODES[row.tracking_mode ?? "individual"], quantity: row.quantity ?? 1, department: assignment ? row.assigned_department_name ?? departmentById.get(assignment.department_id ?? "") ?? "" : "", assignee: assignment?.assignee_id ? row.assignee_name ?? userById.get(assignment.assignee_id) ?? "" : "", location: locationById.get(row.location_id ?? "") ?? "", condition_status: CONDITIONS[row.condition_status ?? "normal"], serial_number: row.serial_number ?? "", note: row.note ?? "", usage: row.status === "liquidated" ? "Đã thanh lý" : assignment ? "Đang sử dụng" : "Chưa phân công", assigned_at: assignment?.assigned_at ?? "" });
        });
      }
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const now = new Date(), pad = (n: number) => String(n).padStart(2, "0");
      const link = document.createElement("a"); link.href = url; link.download = template ? "mau-nhap-tai-san.xlsx" : `danh-sach-tai-san-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setExcelNotice("Không thể tạo file Excel. Vui lòng thử lại."); }
    finally { setExcelBusy(false); }
  };

  const uploadExcel = async (file?: File) => {
    setValidated(false); setImportRows([]); setValidCount(0); setImportErrors([]);
    if (!file) return;
    setExcelBusy(true);
    try {
      if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Vui lòng chọn file .xlsx.");
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet(ASSET_SHEET); if (!sheet) throw new Error(`Không tìm thấy sheet ${ASSET_SHEET}.`);
      const matrix: string[][] = [];
      for (let r = 1; r <= sheet.rowCount; r++) {
        const cells: string[] = [];
        sheet.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => { cells[col - 1] = cell.text; });
        matrix.push(cells);
      }
      const parsed = parseAssetSheet(matrix); setImportRows(parsed.rows);
      if (parsed.errors.length) { setImportErrors(parsed.errors); return; }
      const response = await fetch("/api/assets/bulk-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "validate", rows: parsed.rows }) });
      const result = await response.json(); if (!response.ok) throw new Error("Không thể kiểm tra dữ liệu. Vui lòng thử lại.");
      setImportErrors(result.errors ?? []); setValidCount(result.valid_count ?? 0); setValidated(result.ok === true);
    } catch (error) { setImportErrors([{ row_number: 1, message: error instanceof Error ? error.message : "Không đọc được file Excel." }]); }
    finally { setExcelBusy(false); }
  };

  const commitExcel = async () => {
    if (!validated || excelBusy || importErrors.length || !validCount) return;
    setExcelBusy(true);
    try {
      const response = await fetch("/api/assets/bulk-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "commit", rows: importRows }) });
      const result = await response.json();
      if (result.errors?.length) { setImportErrors(result.errors); setValidCount(result.valid_count ?? 0); setValidated(false); return; }
      if (!response.ok || typeof result.imported !== "number") throw new Error(result.error ?? "Không thể nhập tài sản.");
      notify("success", `Đã nhập ${result.imported} tài sản`); importDialog.current?.close(); setValidated(false); await loadData();
    } catch (error) { setImportErrors([{ row_number: 1, message: error instanceof Error ? error.message : "Không thể nhập tài sản." }]); setValidated(false); }
    finally { setExcelBusy(false); }
  };

  const hasActiveFilters = Boolean(qName || qDepartment || qLocation || qCondition || qUsage || qAssignee || quickFilter !== "all");

  return (
    <main className="mobile-page-shell min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6">
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
            <div className="flex flex-wrap items-center gap-3">{loaded && !message ? <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">{summary.total} tài sản</span><span className="mx-2 text-slate-300">·</span>{summary.assigned} đã phân công<span className="mx-2 text-slate-300">·</span><span className="font-semibold text-amber-800">{summary.unassigned} chưa phân công</span></p> : null}{hasPermission("asset.manage") ? <Link href="/assets/new" className="inline-flex min-h-11 items-center rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-300">+ Thêm tài sản</Link> : null}</div>
          </header>
          <div className="mb-4 flex flex-wrap gap-2">
            {(hasPermission("asset.view") || hasPermission("asset.manage")) ? <button type="button" disabled={excelBusy || !loaded || !excelOptionsLoaded || Boolean(message)} onClick={() => void downloadExcel(false)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold disabled:opacity-50">Xuất Excel</button> : null}
            {hasPermission("asset.manage") ? <><button type="button" disabled={excelBusy || !loaded || !excelOptionsLoaded} onClick={() => void downloadExcel(true)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold disabled:opacity-50">Tải file mẫu</button><button type="button" disabled={excelBusy} onClick={() => { setImportRows([]); setImportErrors([]); setValidCount(0); setValidated(false); const input = importDialog.current?.querySelector("input"); if (input) input.value = ""; importDialog.current?.showModal(); }} className="min-h-11 rounded-lg bg-orange-700 px-4 text-sm font-semibold text-white disabled:opacity-50">Nhập từ Excel</button></> : null}
          </div>
          {excelNotice ? <p role="status" className="mb-4 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">{excelNotice}</p> : null}
          <dialog ref={importDialog} aria-labelledby="excel-import-title" onCancel={event => { if (excelBusy) event.preventDefault(); }} className="mobile-native-sheet fixed inset-0 m-auto max-h-[85vh] w-[min(640px,94vw)] overflow-y-auto rounded-2xl p-6 shadow-xl backdrop:bg-black/40">
            <h2 id="excel-import-title" className="text-lg font-bold">Nhập tài sản từ Excel</h2>
            <p className="mt-2 text-sm text-slate-600">Chọn file .xlsx theo mẫu, tối đa 1000 dòng. Kiểm tra dữ liệu trước khi nhập.</p>
            <input key={importRows.length ? "selected" : "empty"} aria-label="Chọn file Excel" type="file" accept=".xlsx" disabled={excelBusy} onChange={event => void uploadExcel(event.target.files?.[0])} className="my-4 w-full rounded-lg border p-3" />
            <p role="status">{excelBusy ? "Đang xử lý..." : `Số dòng hợp lệ: ${validCount}`}</p>
            <ul role="alert" className="my-3 max-h-64 overflow-y-auto text-sm text-rose-700">{importErrors.map((error, i) => <li key={i}>Dòng {error.row_number}: {error.message}</li>)}</ul>
            <div className="mt-4 flex justify-end gap-3"><button type="button" disabled={excelBusy} onClick={() => importDialog.current?.close()} className="min-h-11 rounded-lg border px-4">Đóng</button><button type="button" disabled={excelBusy || !validated || importErrors.length > 0 || !validCount} onClick={() => void commitExcel()} className="min-h-11 rounded-lg bg-orange-700 px-4 font-semibold text-white disabled:opacity-50">Nhập {validCount} tài sản</button></div>
          </dialog>

<MobileFilters>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3"><div><p className="text-sm font-bold tracking-tight text-slate-900">Bộ lọc danh sách</p><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Thu hẹp danh sách theo tài sản, đơn vị, người sử dụng và tình trạng.</p></div><button type="button" onClick={clearFilters} aria-label="Xóa tất cả bộ lọc" className={`min-h-9 rounded-lg px-2.5 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-orange-300 ${hasActiveFilters ? "text-orange-700 hover:bg-orange-50 hover:text-orange-900" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}>Xóa lọc</button></div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 items-start">
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-slate-700"><span>Tên tài sản</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" placeholder="Tìm tên tài sản..." value={qName} onChange={(event) => setQName(event.target.value)} /></label>
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-slate-700"><span>Phòng ban</span><select className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" value={qDepartment} onChange={(event) => { setQDepartment(event.target.value); setQAssignee(""); setQEmployeeSearch(""); setEmployeeActiveIndex(0); setEmployeeOpen(false); }}><option value="">Tất cả phòng ban</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-slate-700"><span>Vị trí tài sản</span><select aria-label="Lọc theo vị trí tài sản" className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" value={qLocation} onChange={(event) => setQLocation(event.target.value)}><option value="">Tất cả vị trí</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
              <div ref={employeeFilterRef} className="relative z-30 flex min-w-0 self-start gap-1.5 h-fit flex-col text-sm font-semibold text-slate-700">
                <span>Nhân viên</span>
                {qAssignee === "__shared" ? <button type="button" aria-label="Xóa lọc tài sản dùng chung của phòng" onClick={() => { setQAssignee(""); setQEmployeeSearch(""); setEmployeeOpen(false); }} className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 text-left text-sm font-semibold text-orange-900 focus:outline-none focus:ring-2 focus:ring-orange-200"><span className="truncate">Dùng chung của phòng</span><span aria-hidden="true" className="text-base">×</span></button> : <input role="combobox" aria-controls="employee-filter-options" aria-expanded={employeeOpen} disabled={!qDepartment} className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" placeholder={qDepartment ? "Tìm nhân viên..." : "Chọn phòng trước"} value={qAssignee ? (users.find((person) => person.id === qAssignee)?.full_name ?? "") : qEmployeeSearch} onFocus={() => { if (qDepartment) setEmployeeOpen(true); }} onChange={(event) => { setQAssignee(""); setQEmployeeSearch(event.target.value); setEmployeeActiveIndex(0); setEmployeeOpen(true); }} onKeyDown={(event) => { const matches = users.filter((person) => person.department_id === qDepartment && normalizeVietnamese(person.full_name).includes(normalizeVietnamese(qEmployeeSearch))).slice(0, 8); if (event.key === "Escape") { event.preventDefault(); setEmployeeOpen(false); } if (event.key === "ArrowDown") { event.preventDefault(); setEmployeeOpen(true); setEmployeeActiveIndex((index) => Math.min(index + 1, Math.max(matches.length - 1, 0))); } if (event.key === "ArrowUp") { event.preventDefault(); setEmployeeOpen(true); setEmployeeActiveIndex((index) => Math.max(index - 1, 0)); } if (event.key === "Enter") { const match = matches[employeeActiveIndex] ?? matches[0]; if (match) { setQAssignee(match.id); setQEmployeeSearch(""); setEmployeeOpen(false); } } }} />}
                {qDepartment && employeeOpen && qAssignee !== "__shared" ? <div id="employee-filter-options" role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"><button type="button" role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => { setQAssignee("__shared"); setQEmployeeSearch(""); setEmployeeOpen(false); setEmployeeActiveIndex(0); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-orange-800 hover:bg-orange-50">Tài sản dùng chung của phòng</button>{users.filter((person) => person.department_id === qDepartment && normalizeVietnamese(person.full_name).includes(normalizeVietnamese(qEmployeeSearch))).slice(0, 8).map((person, index) => <button type="button" role="option" aria-selected={index === employeeActiveIndex} key={person.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setQAssignee(person.id); setQEmployeeSearch(""); setEmployeeOpen(false); }} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${index === employeeActiveIndex ? "bg-orange-50 text-orange-950" : "hover:bg-slate-50"}`}>{person.full_name}</button>)}</div> : null}
                {qDepartment ? <button type="button" aria-pressed={qAssignee === "__shared"} onClick={() => { setQAssignee(qAssignee === "__shared" ? "" : "__shared"); setQEmployeeSearch(""); setEmployeeOpen(false); setEmployeeActiveIndex(0); }} className={`mt-0.5 leading-4 rounded-md px-1 text-left text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-orange-200 ${qAssignee === "__shared" ? "text-orange-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}>Tài sản dùng chung của phòng</button> : <span className="mt-0.5 text-xs leading-4 font-medium text-slate-400">Chọn phòng để lọc theo nhân viên</span>}
              </div>
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-slate-700"><span>Trạng thái sử dụng</span><select className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" value={qUsage} onChange={(event) => setQUsage(event.target.value)}><option value="">Tất cả</option><option value="assigned">Đang sử dụng</option><option value="unassigned">Chưa phân công</option><option value="liquidated">Đã thanh lý</option></select></label>
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-slate-700"><span>Tình trạng</span><select className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200" value={qCondition} onChange={(event) => setQCondition(event.target.value)}><option value="">Tất cả tình trạng</option><option value="normal">Bình thường</option><option value="needs_maintenance">Cần bảo trì</option><option value="under_service">Đang sửa chữa</option><option value="broken">Hỏng</option></select></label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3" aria-label="Bộ lọc nhanh"><span className="mr-1 text-xs font-bold uppercase tracking-wide text-slate-400">Lọc nhanh</span>{quickFilters.map((filter) => <button key={filter.value} type="button" aria-pressed={quickFilter === filter.value} onClick={() => setQuickFilter(filter.value)} className={`min-h-9 rounded-full border px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-300 ${quickFilter === filter.value ? "border-orange-300 bg-orange-50 text-orange-900" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>{filter.label}</button>)}</div>
            {message ? loaded ? <ErrorState message={message} /> : <LoadingState label={message} /> : null}
          </section>

</MobileFilters>
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{filteredRows.length === summary.total ? `${summary.total} tài sản` : `Hiển thị ${filteredRows.length} / ${summary.total} tài sản`}</p>
            </div>

            <div className="hidden md:block">
              <div ref={tableScrollRef} className="table-scroll max-h-[72vh] rounded-xl border border-slate-200" tabIndex={0} aria-label="Danh sách tài sản; có thể cuộn ngang trên màn hình hẹp">
                <table className="data-table table-fixed min-w-[1080px] text-left text-sm">
                  <colgroup>
                    <col className="w-[25%]" />
                    <col className="w-[72px]" />
                    <col className="w-[142px]" />
                    <col className="w-[124px]" />
                    <col className="w-[17%]" />
                    <col className="w-[17%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-slate-50/95 text-slate-500 backdrop-blur">
                    <tr>
                      <th scope="col" className="border-b border-slate-200 px-4 py-3 text-xs font-bold uppercase tracking-[0.08em]">Tài sản</th>
                      <th scope="col" className="border-b border-slate-200 px-2 py-3 text-center text-xs font-bold uppercase tracking-[0.08em]">SL</th>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-xs font-bold uppercase tracking-[0.08em]">Sử dụng</th>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-xs font-bold uppercase tracking-[0.08em]">Tình trạng</th>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-xs font-bold uppercase tracking-[0.08em]">Vị trí</th>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-xs font-bold uppercase tracking-[0.08em]">Người sử dụng</th>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-xs font-bold uppercase tracking-[0.08em]">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row) => {
                      const owner = custody(row);
                      return <tr key={row.id ?? row.asset_code} className="group cursor-pointer transition-colors hover:bg-orange-50/45" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) return; openAsset(row.id); }}>
                        <td className="px-4 py-4 align-top"><Link href={`/assets/${row.id}`} onClick={saveViewState} aria-label={`Mở chi tiết tài sản ${row.asset_name}`} className="block rounded-md focus:outline-none focus:ring-2 focus:ring-orange-300"><p className="line-clamp-2 break-words font-bold leading-5 text-slate-950 group-hover:text-orange-800" title={row.asset_name}>{row.asset_name}</p>{row.asset_code ? <p className="mt-1 text-xs font-medium tracking-wide text-slate-500">{row.asset_code}</p> : null}</Link></td>
                        <td className="px-2 py-4 text-center align-top text-base font-bold tabular-nums text-slate-900">{row.quantity ?? 1}</td>
                        <td className="px-3 py-4 align-top"><StatusBadge row={row} /></td>
                        <td className="px-3 py-4 align-top"><ConditionBadge row={row} /></td>
                        <td className="px-3 py-4 align-top"><span className={`inline-flex max-w-full items-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold leading-4 ${row.location_id ? "border-sky-200 bg-sky-50 text-sky-800" : "border-dashed border-slate-300 bg-slate-50 text-slate-500"}`}>{locationLabel(row)}</span></td>
                        <td className="px-3 py-4 align-top"><p className={`break-words font-medium leading-5 ${owner.unassigned ? "text-amber-900" : "text-slate-900"}`}>{owner.person}</p>{owner.department !== "Không áp dụng" ? <p className="mt-1 text-xs text-slate-500">{owner.department}</p> : null}</td>
                        <td className="px-3 py-4 align-top"><p className="line-clamp-2 break-words leading-5 text-slate-600" title={row.note ?? undefined}>{row.note || "—"}</p></td>
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
                return <Link key={row.id ?? row.asset_code} href={`/assets/${row.id}`} onClick={saveViewState} aria-label={`Mở chi tiết tài sản ${row.asset_name}`} className="block cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-orange-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-300">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold leading-5 text-slate-950">{row.asset_name}</h2>{row.asset_code ? <p className="mt-1 text-xs font-medium text-slate-500">{row.asset_code}</p> : null}</div><div className="flex flex-wrap justify-end gap-1"><StatusBadge row={row} /><ConditionBadge row={row} /></div></div>
                  <div className="mt-3 flex flex-wrap gap-2"><MetadataBadge>{row.category || "Chưa rõ"}</MetadataBadge><MetadataBadge tone={row.tracking_mode === "lot" ? "sky" : "slate"}>{row.tracking_mode === "lot" ? "Theo lô" : "Cá thể"}</MetadataBadge><MetadataBadge>SL: {row.quantity ?? 1}</MetadataBadge></div>
                  <dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vị trí</dt><dd className={`mt-1 font-medium ${row.location_id ? "text-slate-800" : "text-slate-500"}`}>{locationLabel(row)}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Người sử dụng</dt><dd className={`mt-1 ${owner.unassigned ? "font-medium text-amber-700" : "text-slate-600"}`}>{owner.person}</dd></div>{row.note ? <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ghi chú</dt><dd className="mt-1 line-clamp-2 leading-5 text-slate-600" title={row.note}>{row.note}</dd></div> : null}</dl>
                </Link>;
              })}
              {loaded && !message && filteredRows.length === 0 ? <EmptyState title="Không có tài sản phù hợp bộ lọc." /> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
