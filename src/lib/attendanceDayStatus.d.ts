export type AttendanceDayStatus = { code: string; symbol: string; label: string; workday: number };
export function classifyAttendanceDay(input: {
  workDate: string;
  today: string;
  isBusinessDate: boolean;
  log?: { check_in?: string | null; check_out?: string | null } | null;
  leave?: { full: boolean } | null;
  online?: boolean;
  business?: boolean;
  adjustment?: { workday: number } | null;
  calculation?: { workday: number; late?: boolean; early?: boolean } | null;
}): AttendanceDayStatus;
export const ATTENDANCE_DAY_STATUS_LABELS: Record<string, string>;
