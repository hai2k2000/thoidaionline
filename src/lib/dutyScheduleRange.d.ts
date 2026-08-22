export type DutyScheduleView = "day" | "week" | "month";
export function scheduleRange(view: DutyScheduleView, anchor: string): { from: string; to: string };
