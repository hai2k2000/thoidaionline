export const DUTY_POSITIONS: readonly string[];
export type DutyRosterDay = { date: string; weekday: number; assignments: Record<string, string> };
export function monthDays(month: string): DutyRosterDay[];
export function completeRows(days: DutyRosterDay[], positions?: readonly string[]): DutyRosterDay[];
