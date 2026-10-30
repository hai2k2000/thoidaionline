export function exportWorkdays(month: string, gridDays: string[]): string[];
export function exportDayHeader(workDate: string): string;
export function exportTitle(month: string): string;
export function exportCellValue(cell: { code: string; symbol?: string; workday: number } | undefined): string | number;
export function buildAttendanceExportSheet(month: string, grid: { days: string[]; rows: Array<{ staffId: string; name: string; departmentName: string; cells: Array<{ date: string; code: string; symbol?: string; workday: number }> }> }, monthlyRows?: Array<{ user_id: string; work_date: string; note?: string | null }>): { name: string; columns: Array<{ width: number }>; rows: Array<{ height?: number; cells: Array<{ value: string | number; style?: string }> }>; merges: string[]; freeze: { rows: number; columns: number } };
export function buildAttendanceExportXlsx(month: string, grid: Parameters<typeof buildAttendanceExportSheet>[1], monthlyRows?: Parameters<typeof buildAttendanceExportSheet>[2]): Buffer;
