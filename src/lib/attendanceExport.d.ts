export function csvCell(value: unknown): string;
export function exportWorkdays(month: string, gridDays: string[]): string[];
export function exportDayHeader(workDate: string): string;
export function exportCellValue(cell: { code: string; workday: number } | undefined): string | number;
export function buildAttendanceExportCsv(
  month: string,
  grid: { days: string[]; rows: Array<{ staffId: string; name: string; departmentName: string; cells: Array<{ date: string; code: string; workday: number }> }> },
  monthlyRows: Array<{ user_id: string; work_date: string; note?: string | null }>,
): string;
