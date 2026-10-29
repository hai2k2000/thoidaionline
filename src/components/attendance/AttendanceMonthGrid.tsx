type Cell = { date: string; code: string; symbol: string; label: string; workday: number };
type GridRow = { staffId: string; name: string; departmentName: string; cells: Cell[]; totalWorkday: number };

const colorByCode: Record<string, string> = {
  present: "text-green-600", incomplete: "text-orange-500", absent: "text-red-600", leave_full: "text-blue-600", leave_half: "text-blue-600", online: "text-purple-600", business: "text-slate-700", weekend: "text-slate-400", future: "text-slate-400",
};

export default function AttendanceMonthGrid({ days, rows, onCellClick }: { days: string[]; rows: GridRow[]; onCellClick?: (staffId: string, date: string) => void }) {
  return <>
    <div className="table-scroll max-w-full overflow-x-auto rounded-lg border border-slate-200" aria-label="Lưới chấm công theo tháng">
      <table className="min-w-max text-center text-xs">
        <thead className="bg-slate-50"><tr><th className="sticky left-0 z-20 min-w-48 bg-slate-50 px-3 py-2 text-left">Nhân sự</th>{days.map((day) => { const date = new Date(`${day}T12:00:00Z`); const weekday = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][date.getUTCDay()]; return <th key={day} className={`px-1 py-2 ${days.length <= 7 ? "min-w-20" : "min-w-10"}`}><span className="block">{days.length <= 7 ? `${weekday} ${day.slice(-2)}/${day.slice(5, 7)}` : day.slice(-2)}</span>{days.length > 7 ? <span className="text-[10px] text-slate-500">{weekday}</span> : null}</th>; })}<th className="min-w-20 px-2 py-2">Tổng công</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.staffId} className="border-t"><th className="sticky left-0 z-10 bg-white px-3 py-2 text-left"><span className="block font-semibold">{row.name}</span><span className="text-[10px] font-normal text-slate-500">{row.departmentName}</span></th>{row.cells.map((cell) => <td key={cell.date} className={`px-1 py-2 text-base font-bold ${colorByCode[cell.code] ?? "text-slate-700"}`} title={`${cell.date} — ${cell.label}`} aria-label={`${cell.date} — ${cell.label}`} onClick={() => onCellClick?.(row.staffId, cell.date)} role={onCellClick ? "button" : undefined} tabIndex={onCellClick ? 0 : undefined}>{cell.symbol}</td>)}<td className="px-2 py-2 font-semibold">{row.totalWorkday}</td></tr>)}</tbody>
      </table>
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Chú giải lưới chấm công"><span>✓ Đi làm</span><span className="text-orange-500">✓ Thiếu giờ/đi muộn</span><span className="text-red-600">✗ Vắng</span><span className="text-blue-600">P / ½P Nghỉ phép</span><span className="text-slate-700">CT Công tác/Sự kiện</span><span className="text-purple-600">O Online</span><span className="text-slate-400">· Cuối tuần</span></div>
  </>;
}
