const dateInRange = (date, start, end) => date >= start && date <= end;

const participantIdsFor = (schedule) => Array.from(new Set([
  ...(Array.isArray(schedule?.participant_ids) ? schedule.participant_ids : []),
  ...(Array.isArray(schedule?.event_assignments)
    ? schedule.event_assignments.map((assignment) => assignment?.staff_id).filter(Boolean)
    : []),
]));

const isApprovedSchedule = (schedule) =>
  schedule?.approval_status === "APPROVED"
  && schedule?.event_status !== "CANCELLED"
  && (schedule?.schedule_scope === "personal" || schedule?.schedule_scope === "organization" || schedule?.schedule_scope == null);

const scheduleText = (schedule) => {
  const title = typeof schedule?.title === "string" ? schedule.title.trim() : "";
  const location = typeof schedule?.location === "string" ? schedule.location.trim() : "";
  const kind = schedule?.plan_type === "business" ? "Đi công tác" : "Đi sự kiện";
  if (!title) return kind;
  return location ? `${kind}: ${title} · ${location}` : `${kind}: ${title}`;
};

export const attendanceScheduleNoteEntriesFor = (schedules, userId, workDate) => {
  const entries = [];
  for (const schedule of schedules ?? []) {
    if (!isApprovedSchedule(schedule)) continue;
    if (!["business", "event"].includes(schedule?.plan_type)) continue;
    if (!schedule?.work_date || !schedule?.end_date || !dateInRange(workDate, schedule.work_date, schedule.end_date)) continue;
    if (!participantIdsFor(schedule).includes(userId)) continue;
    const entry = { kind: schedule.plan_type, text: scheduleText(schedule) };
    if (!entries.some((item) => item.kind === entry.kind && item.text === entry.text)) entries.push(entry);
  }
  return entries;
};

export const attendanceScheduleNotesFor = (schedules, userId, workDate) =>
  attendanceScheduleNoteEntriesFor(schedules, userId, workDate).map((entry) => entry.text);
