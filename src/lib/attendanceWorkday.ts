export const LATEST_ON_TIME_CHECK_IN = "08:15:00";
export const EARLIEST_NORMAL_CHECK_OUT = "16:30:00";

export type AttendanceCalculationInput = {
  checkIn?: string | null;
  checkOut?: string | null;
  existingNote?: string | null;
  extraNotes?: string[];
  exceptional?: boolean;
  exceptionalWorkday?: number;
};

export type AttendanceCalculation = {
  workday: number;
  late: boolean;
  early: boolean;
  note: string;
};

const timeToSeconds = (value?: string | null) => {
  if (!value) return null;
  const parts = value.split(":").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const [hours, minutes, seconds = 0] = parts;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
};

const splitNotes = (value?: string | null) => (value ?? "").split(";").map((part) => part.trim()).filter(Boolean);
const WISE_ON_39_SYNC_NOTE = /^đồng\s*bộ(?:\s+realtime)?\s+từ\s+wise(?:\s+eye)?\s*on\s*39$/iu;

export const sanitizeAttendanceNotes = (values: Array<string | null | undefined>) => values
  .flatMap(splitNotes)
  .filter((note) => !WISE_ON_39_SYNC_NOTE.test(note));

export const calculateAttendance = ({ checkIn, checkOut, existingNote, extraNotes = [], exceptional = false, exceptionalWorkday = 0 }: AttendanceCalculationInput): AttendanceCalculation => {
  const checkInSeconds = timeToSeconds(checkIn);
  const checkOutSeconds = timeToSeconds(checkOut);
  const complete = checkInSeconds !== null && checkOutSeconds !== null;
  const late = !exceptional && checkInSeconds !== null && checkInSeconds > timeToSeconds(LATEST_ON_TIME_CHECK_IN)!;
  const early = !exceptional && checkOutSeconds !== null && checkOutSeconds < timeToSeconds(EARLIEST_NORMAL_CHECK_OUT)!;
  const generated = exceptional
    ? []
    : [
        ...(late ? ["Đi muộn"] : []),
        ...(early ? ["Về sớm"] : []),
        ...(checkInSeconds === null && checkOutSeconds === null ? ["Thiếu giờ vào", "Thiếu giờ ra"] : checkInSeconds === null ? ["Thiếu giờ vào"] : checkOutSeconds === null ? ["Thiếu giờ ra"] : []),
      ];
  const notes = [...generated, ...sanitizeAttendanceNotes([...extraNotes, existingNote])];
  const uniqueNotes = notes.filter((note, index) => notes.indexOf(note) === index);
  return { workday: exceptional ? exceptionalWorkday : complete ? 1 : 0, late, early, note: uniqueNotes.join("; ") };
};
