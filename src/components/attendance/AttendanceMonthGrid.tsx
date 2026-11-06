type Cell = { date: string; code: string; symbol: string; label: string; workday: number };
type GridRow = { staffId: string; name: string; departmentName: string; cells: Cell[]; totalWorkday: number };
import MobileCardList, { MobileCard, MobileCardBadge, type MobileCardBadgeTone } from "@/components/mobile/MobileCardList";

const colorByCode: Record<string, string> = {
  present: "text-green-600", incomplete: "text-orange-500", absent: "text-red-600", leave_full: "text-blue-600", leave_half: "text-blue-600", online: "text-purple-600", business: "text-slate-700", event: "text-slate-700", weekend: "text-slate-400", future: "text-slate-400", forgot_card: "text-amber-600", forgot_swipe: "text-amber-600",
};

const mobileToneByCode: Record<string, MobileCardBadgeTone> = {
  present: "success", incomplete: "warning", absent: "danger", leave_full: "info", leave_half: "info",
  online: "info", business: "brand", event: "brand", forgot_card: "warning", forgot_swipe: "warning",
};

export default function AttendanceMonthGrid({ days, rows, onCellClick }: { days: string[]; rows: GridRow[]; onCellClick?: (staffId: string, date: string) => void }) {
  return <>
    <MobileCardList ariaLabel="Tóm tắt chấm công theo tháng">
      {rows.map((row) => {
        const counts = row.cells.reduce<Record<string, { cell: Cell; count: number }>>((acc, cell) => {
          acc[cell.code] = { cell, count: (acc[cell.code]?.count ?? 0) + 1 }; return acc;
        }, {});
        const offset = row.cells.length ? (new Date(`${row.cells[0].date}T12:00:00Z`).getUTCDay() + 6) % 7 : 0;
        return <MobileCard key={row.staffId} title={<>{row.name}<span className="mt-1 block text-xs font-normal text-text-muted">{row.departmentName}</span></>} meta={[{ label: "Tổng công", value: row.totalWorkday }]}>
          <dl className="mt-3 flex flex-wrap gap-2" aria-label="Số ngày theo mã">{Object.values(counts).map(({ cell, count }) => <div key={cell.code} className="flex items-center gap-1 text-sm"><dt><MobileCardBadge tone={mobileToneByCode[cell.code] ?? "neutral"}><span aria-label={cell.label} title={cell.label}>{cell.symbol || "—"} {cell.label}</span></MobileCardBadge></dt><dd>{count}</dd></div>)}</dl>
          <details className="mt-3 rounded-[var(--radius-control)] border border-border bg-surface-muted p-1">
            <summary className="min-h-11 cursor-pointer px-2 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-brand">Xem lịch {days.length} ngày</summary>
            <div className="grid grid-cols-7 text-center text-xs" aria-label="Lịch chấm công">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day} className="py-2 text-text-muted">{day}</span>)}
              {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
              {row.cells.map((cell) => {
                const content = <><span className="block text-xs font-normal text-text-muted">{cell.date.slice(-2)}</span><span className="block font-semibold">{cell.symbol || "—"}</span></>;
                const label = `${cell.date} — ${cell.label}`;
                return onCellClick ? <button key={cell.date} type="button" aria-label={label} title={label} onClick={() => onCellClick(row.staffId, cell.date)} className="min-h-11 min-w-0 rounded-[var(--radius-control)] border border-border bg-surface py-1 text-sm text-brand-ink focus-visible:ring-2 focus-visible:ring-brand">{content}</button> : <span key={cell.date} aria-label={label} title={label} className="min-h-11 min-w-0 rounded-[var(--radius-control)] border border-border bg-surface py-1 text-sm text-text">{content}</span>;
              })}
            </div>
          </details>
        </MobileCard>;
      })}
    </MobileCardList>
    <div className="table-scroll hidden max-w-full overflow-x-auto rounded-lg border border-slate-200 md:block" aria-label="Lưới chấm công theo tháng">
      <table className="min-w-max text-center text-xs">
        <thead className="bg-slate-50"><tr><th className="sticky left-0 z-20 min-w-48 bg-slate-50 px-3 py-2 text-left">Nhân sự</th>{days.map((day) => { const date = new Date(`${day}T12:00:00Z`); const weekday = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][date.getUTCDay()]; return <th key={day} className={`px-1 py-2 ${days.length <= 7 ? "min-w-20" : "min-w-10"}`}><span className="block">{days.length <= 7 ? `${weekday} ${day.slice(-2)}/${day.slice(5, 7)}` : day.slice(-2)}</span>{days.length > 7 ? <span className="text-xs text-slate-500">{weekday}</span> : null}</th>; })}<th className="min-w-20 px-2 py-2">Tổng công</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.staffId} className="border-t"><th className="sticky left-0 z-10 bg-white px-3 py-2 text-left"><span className="block font-semibold">{row.name}</span><span className="text-xs font-normal text-slate-500">{row.departmentName}</span></th>{row.cells.map((cell) => <td key={cell.date} className={`px-1 py-2 text-base font-bold ${colorByCode[cell.code] ?? "text-slate-700"}`} title={`${cell.date} — ${cell.label}`} aria-label={`${cell.date} — ${cell.label}`} onClick={() => onCellClick?.(row.staffId, cell.date)} role={onCellClick ? "button" : undefined} tabIndex={onCellClick ? 0 : undefined}>{cell.symbol}</td>)}<td className="px-2 py-2 font-semibold">{row.totalWorkday}</td></tr>)}</tbody>
      </table>
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Chú giải lưới chấm công"><span>✓ Đi làm</span><span className="text-orange-500">✓ Thiếu giờ/đi muộn</span><span className="text-red-600">✗ Vắng</span><span className="text-blue-600">P / ½P Nghỉ phép</span><span className="text-slate-700">CT = Đi công tác</span><span className="text-slate-700">SK = Đi sự kiện</span><span className="text-purple-600">OL = Làm việc online</span><span className="text-slate-400">· Cuối tuần</span><span className="text-amber-600">QT = Quên thẻ</span><span className="text-amber-600">QQ = Quên quẹt thẻ</span></div>
  </>;
}
