export type LocalPlanInterval = {
  workDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function parseDate(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day < 1 || day > daysInMonth) return null;
  return { year, month, day };
}

function civilDayNumber(year: number, month: number, day: number) {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const monthOfYear = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * monthOfYear + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra;
}

function minuteOfDay(value: string) {
  if (!TIME_PATTERN.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

export function validateLocalPlanInterval(input: LocalPlanInterval): ValidationResult {
  const startDate = parseDate(input.workDate);
  const endDate = parseDate(input.endDate);
  const startMinute = minuteOfDay(input.startTime);
  const endMinute = minuteOfDay(input.endTime);
  if (!startDate || !endDate || startMinute === null || endMinute === null) {
    return { ok: false, reason: "invalid_date_or_time" };
  }
  const start = civilDayNumber(startDate.year, startDate.month, startDate.day) * 1440 + startMinute;
  const end = civilDayNumber(endDate.year, endDate.month, endDate.day) * 1440 + endMinute;
  return end > start ? { ok: true } : { ok: false, reason: "end_must_follow_start" };
}

export type PersonalPlanContent = {
  planType: string;
  workDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  title: string;
  location: string | null;
  notes: string | null;
};

export function isMaterialPersonalPlanChange(before: PersonalPlanContent, after: PersonalPlanContent) {
  return ["planType", "workDate", "endDate", "startTime", "endTime", "title", "location", "notes"]
    .some((field) => before[field as keyof PersonalPlanContent] !== after[field as keyof PersonalPlanContent]);
}
