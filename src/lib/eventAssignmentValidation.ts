export type EventAssignmentInput = {
  title: string;
  eventType: string;
  workDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reporterIds: string[];
};

export type EventAssignmentValidation =
  | { ok: true }
  | { ok: false; reason: string };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function civilDayNumber(year: number, month: number, day: number) {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const monthOfYear = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * monthOfYear + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra;
}

function localIntervalValid(input: Pick<EventAssignmentInput, "workDate" | "endDate" | "startTime" | "endTime">) {
  const start = DATE_PATTERN.exec(input.workDate);
  const end = DATE_PATTERN.exec(input.endDate);
  if (!start || !end || !TIME_PATTERN.test(input.startTime) || !TIME_PATTERN.test(input.endTime)) return false;
  const leap = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const validDate = (match: RegExpExecArray) => {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const days = [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    return month >= 1 && month <= 12 && day >= 1 && day <= days;
  };
  if (!validDate(start) || !validDate(end)) return false;
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  return civilDayNumber(Number(end[1]), Number(end[2]), Number(end[3])) * 1440 + minutes(input.endTime)
    > civilDayNumber(Number(start[1]), Number(start[2]), Number(start[3])) * 1440 + minutes(input.startTime);
}

export function validateEventAssignmentInput(input: EventAssignmentInput): EventAssignmentValidation {
  if (!input.title.trim() || input.title.trim().length > 500) return { ok: false, reason: "invalid_title" };
  if (!input.eventType.trim() || input.eventType.trim().length > 100) return { ok: false, reason: "invalid_event_type" };
  if (!localIntervalValid(input)) return { ok: false, reason: "invalid_date_or_time" };
  if (!input.reporterIds.length || input.reporterIds.length > 50) return { ok: false, reason: "invalid_reporters" };
  if (new Set(input.reporterIds).size !== input.reporterIds.length) return { ok: false, reason: "duplicate_reporter" };
  if (input.reporterIds.some((id) => !id || typeof id !== "string")) return { ok: false, reason: "invalid_reporter" };
  return { ok: true };
}
