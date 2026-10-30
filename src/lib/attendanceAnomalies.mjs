const severityRank = { high: 0, medium: 1, low: 2 };

const seconds = (value) => {
  if (!value || !/^\d{2}:\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes, secs] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + secs;
};
const daysBetween = (start, end) => {
  const result = [];
  for (let cursor = new Date(`${start}T12:00:00Z`); cursor <= new Date(`${end}T12:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) result.push(cursor.toISOString().slice(0, 10));
  return result;
};
const participantIds = (schedule, assignments) => new Set([
  ...(schedule.participant_ids ?? []),
  ...assignments.filter((item) => item.event_id === schedule.id).map((item) => item.staff_id),
]);
const periodsForDate = (leave, date) => {
  if (leave.start_date === leave.end_date) return [leave.start_period, leave.end_period];
  if (date === leave.start_date) return [leave.start_period, leave.start_period];
  if (date === leave.end_date) return [leave.end_period, leave.end_period];
  return ["full", "full"];
};
const isFull = (period) => period === "full" || period === "full_day";

const viDate = (date) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
export function detectAttendanceAnomalies(input) {
  // Null-safe: empty result sets may arrive as null.
  const { thresholdSeconds = 10 } = input;
  const [logs, leaves, schedules, eventAssignments, staff] = [input.logs, input.leaves, input.schedules, input.eventAssignments, input.staff].map((value) => value ?? []);
  const staffById = new Map(staff.map((item) => [item.id, item]));
  const findings = [];
  const pairDays = new Map();
  const byDate = new Map();
  for (const row of logs) {
    if (!byDate.has(row.work_date)) byDate.set(row.work_date, []);
    byDate.get(row.work_date).push(row);
  }
  for (const [date, rows] of byDate) {
    for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
        const left = rows[leftIndex]; const right = rows[rightIndex];
        if (left.user_id === right.user_id) continue;
        const leftIn = seconds(left.check_in); const rightIn = seconds(right.check_in); const leftOut = seconds(left.check_out); const rightOut = seconds(right.check_out);
        if ([leftIn, rightIn, leftOut, rightOut].some((value) => value == null) || Math.abs(leftIn - rightIn) > thresholdSeconds || Math.abs(leftOut - rightOut) > thresholdSeconds) continue;
        const pair = [left.user_id, right.user_id].sort();
        const key = pair.join(":");
        if (!pairDays.has(key)) pairDays.set(key, []);
        pairDays.get(key).push(date);
        findings.push({ type: "same_time_pair", severity: "medium", staffIds: pair, date, detail: { times: { [left.user_id]: { checkIn: left.check_in, checkOut: left.check_out }, [right.user_id]: { checkIn: right.check_in, checkOut: right.check_out } } }, message: `Hai nhân sự có giờ chấm công gần trùng nhau ngày ${viDate(date)}.` });
      }
    }
  }
  for (const leave of leaves) {
    for (const date of daysBetween(leave.start_date, leave.end_date)) {
      const row = logs.find((item) => item.user_id === leave.requester_id && item.work_date === date);
      if (!row || (!row.check_in && !row.check_out)) continue;
      const [startPeriod, endPeriod] = periodsForDate(leave, date);
      const inSeconds = seconds(row.check_in); const outSeconds = seconds(row.check_out);
      const flagged = (isFull(startPeriod) && isFull(endPeriod)) || (startPeriod === "morning" && inSeconds != null && inSeconds < 12 * 3600) || (endPeriod === "afternoon" && outSeconds != null && outSeconds > (13 * 3600 + 30 * 60));
      if (flagged) findings.push({ type: "leave_with_punch", severity: "high", staffIds: [leave.requester_id], date, detail: { leaveId: leave.id, period: { start: startPeriod, end: endPeriod }, checkIn: row.check_in, checkOut: row.check_out }, message: `Nhân sự vẫn chấm công trong thời gian nghỉ ngày ${viDate(date)}.` });
    }
  }
  for (const schedule of schedules) {
    const participants = participantIds(schedule, eventAssignments);
    for (const date of daysBetween(schedule.work_date, schedule.end_date ?? schedule.work_date)) {
      for (const userId of participants) {
        const row = logs.find((item) => item.user_id === userId && item.work_date === date);
        if (!row || (!row.check_in && !row.check_out)) continue;
        const existing = findings.find((item) => item.date === date && item.staffIds.length === 1 && item.staffIds[0] === userId && item.type === (schedule.plan_type === "business" ? "business_with_punch" : "event_with_punch"));
        if (schedule.plan_type === "business") {
          if (existing) { if (schedule.title && !existing.detail.scheduleTitles.includes(schedule.title)) existing.detail.scheduleTitles.push(schedule.title); continue; }
          findings.push({ type: "business_with_punch", severity: "high", staffIds: [userId], date, detail: { scheduleTitles: [schedule.title].filter(Boolean) }, message: `Nhân sự có chấm công trong lịch công tác ngày ${viDate(date)}.` });
        } else if (row.check_in && row.check_out && existing) {
          if (schedule.title && !existing.detail.scheduleTitles.includes(schedule.title)) existing.detail.scheduleTitles.push(schedule.title);
          if (schedule.start_time && schedule.end_time && row.check_in < schedule.start_time && row.check_out > schedule.end_time) { existing.detail.spansEvent = true; existing.severity = "medium"; }
        } else if (row.check_in && row.check_out) {
          const spansEvent = !!schedule.start_time && !!schedule.end_time && row.check_in < schedule.start_time && row.check_out > schedule.end_time;
          findings.push({ type: "event_with_punch", severity: spansEvent ? "medium" : "low", staffIds: [userId], date, detail: { scheduleTitles: [schedule.title].filter(Boolean), checkIn: row.check_in, checkOut: row.check_out, spansEvent }, message: `Nhân sự có đủ giờ chấm công trong lịch sự kiện ngày ${viDate(date)}.` });
        }
      }
    }
  }
  for (const finding of findings) {
    if (finding.type === "same_time_pair" && (pairDays.get(finding.staffIds.join(":"))?.length ?? 0) >= 3) finding.severity = "high";
    const names = finding.staffIds.map((id) => staffById.get(id)?.full_name ?? id).join(" và ");
    finding.message = `${finding.message} (${names})`;
  }
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.date.localeCompare(a.date) || a.staffIds.map((id) => staffById.get(id)?.full_name ?? id).join(" ").localeCompare(b.staffIds.map((id) => staffById.get(id)?.full_name ?? id).join(" "), "vi"));
  const pairSummary = [...pairDays.entries()].map(([key, dates]) => { const ids = key.split(":"); return { staffIds: ids, days: dates.length, dates: [...dates].sort().reverse(), names: ids.map((id) => staffById.get(id)?.full_name ?? id) }; }).sort((a, b) => b.days - a.days || a.names.join(" ").localeCompare(b.names.join(" "), "vi"));
  return { findings, pairSummary };
}
