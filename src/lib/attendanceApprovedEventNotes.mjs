const dateInRange = (date, start, end) => date >= start && date <= end;

export const isApprovedAttendanceEvent = (event) =>
  event?.approval_status === "APPROVED"
  && event?.event_assignment_kind === "leadership"
  && event?.plan_type === "event"
  && event?.event_status !== "CANCELLED";

export const attendanceEventNote = (event) => {
  const title = typeof event?.title === "string" ? event.title.trim() : "";
  if (!title) return "Lịch công tác / sự kiện";
  const location = typeof event?.location === "string" ? event.location.trim() : "";
  return location ? `Lịch công tác: ${title} · ${location}` : `Lịch công tác: ${title}`;
};

export const approvedEventNotesFor = (events, userId, workDate) => {
  const notes = [];
  for (const event of events ?? []) {
    if (!isApprovedAttendanceEvent(event)) continue;
    if (!event?.work_date || !event?.end_date || !dateInRange(workDate, event.work_date, event.end_date)) continue;
    const participantIds = Array.isArray(event.participant_ids) ? event.participant_ids : [];
    const assignmentIds = Array.isArray(event.event_assignments)
      ? event.event_assignments.map((assignment) => assignment?.staff_id).filter(Boolean)
      : [];
    if (!participantIds.includes(userId) && !assignmentIds.includes(userId)) continue;
    const note = attendanceEventNote(event);
    if (!notes.includes(note)) notes.push(note);
  }
  return notes;
};
