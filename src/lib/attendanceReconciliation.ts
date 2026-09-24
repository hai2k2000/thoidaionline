export type RawAttendancePunch = {
  device_id: string;
  enroll_number: string;
  punched_at: string;
};

export type StoredAttendancePunch = Pick<RawAttendancePunch, "device_id" | "enroll_number" | "punched_at">;

export type AttendanceDay = {
  enroll_number: string;
  work_date: string;
  check_in: string;
  check_out: string | null;
  punch_count: number;
};

const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

export const punchKey = (punch: StoredAttendancePunch) => `${punch.device_id}|${punch.enroll_number}|${new Date(punch.punched_at).toISOString()}`;

export const vietnamWorkDate = (punchedAt: string) => {
  const instant = new Date(punchedAt);
  if (!Number.isFinite(instant.valueOf())) throw new Error("invalid_punched_at");
  return instant.toLocaleDateString("en-CA", { timeZone: VN_TIME_ZONE });
};

export const vietnamTime = (punchedAt: string) => {
  const instant = new Date(punchedAt);
  if (!Number.isFinite(instant.valueOf())) throw new Error("invalid_punched_at");
  return instant.toLocaleTimeString("en-GB", { timeZone: VN_TIME_ZONE, hour12: false });
};

export function deriveAttendanceDays(punches: RawAttendancePunch[], from?: string, to?: string): AttendanceDay[] {
  const grouped = new Map<string, RawAttendancePunch[]>();
  for (const punch of punches) {
    const workDate = vietnamWorkDate(punch.punched_at);
    if ((from && workDate < from) || (to && workDate > to)) continue;
    const key = `${punch.enroll_number}|${workDate}`;
    const rows = grouped.get(key) ?? [];
    rows.push(punch);
    grouped.set(key, rows);
  }
  return [...grouped.entries()].map(([key, rows]) => {
    const sorted = [...rows].sort((a, b) => Date.parse(a.punched_at) - Date.parse(b.punched_at));
    const [enroll_number, work_date] = key.split("|");
    return {
      enroll_number,
      work_date,
      check_in: vietnamTime(sorted[0].punched_at),
      check_out: sorted.length > 1 ? vietnamTime(sorted[sorted.length - 1].punched_at) : null,
      punch_count: sorted.length,
    };
  }).sort((a, b) => `${a.work_date}|${a.enroll_number}`.localeCompare(`${b.work_date}|${b.enroll_number}`));
}

export function reconcilePunches(devicePunches: RawAttendancePunch[], storedPunches: StoredAttendancePunch[]) {
  const stored = new Set(storedPunches.map(punchKey));
  const missing = devicePunches.filter((punch) => !stored.has(punchKey(punch)));
  return {
    devicePunchCount: devicePunches.length,
    dbBeforeCount: storedPunches.length,
    insertedCount: missing.length,
    duplicateSkippedCount: devicePunches.length - missing.length,
    missing,
    affectedDays: deriveAttendanceDays(devicePunches).length,
  };
}

export function reconciliationByDate(devicePunches: RawAttendancePunch[], storedPunches: StoredAttendancePunch[], mappedEnrollments: Set<string>) {
  const storedKeys = new Set(storedPunches.map(punchKey));
  const dates = [...new Set(devicePunches.map((punch) => vietnamWorkDate(punch.punched_at)))].sort();
  return dates.map((work_date) => {
    const deviceRows = devicePunches.filter((punch) => vietnamWorkDate(punch.punched_at) === work_date);
    const storedRows = storedPunches.filter((punch) => vietnamWorkDate(punch.punched_at) === work_date);
    const missing = deviceRows.filter((punch) => !storedKeys.has(punchKey(punch)));
    const mapped = deviceRows.filter((punch) => mappedEnrollments.has(punch.enroll_number));
    return {
      work_date,
      device_punch_count: deviceRows.length,
      db_before_count: storedRows.length,
      would_insert: missing.length,
      duplicate_skipped_count: deviceRows.length - missing.length,
      db_after_count: storedRows.length + missing.length,
      attendance_affected: new Set(mapped.map((punch) => punch.enroll_number)).size,
    };
  });
}
