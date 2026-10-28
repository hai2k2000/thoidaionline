const labels = {
  future: ["", "Chưa tới ngày", 0],
  weekend: ["·", "Thứ 7/Chủ nhật", 0],
  leave_full: ["P", "Nghỉ phép", 1],
  leave_half: ["½P", "Nghỉ phép nửa ngày", 0.5],
  business: ["CT", "Công tác/Sự kiện", 1],
  online: ["O", "Làm việc online", 1],
  present: ["✓", "Đi làm", 1],
  incomplete: ["✓", "Đi làm (thiếu giờ/đi muộn/về sớm)", 0],
  absent: ["✗", "Nghỉ không phép", 0],
};

export function classifyAttendanceDay({ workDate, today, isBusinessDate, log = null, leave = null, online = false, business = false, adjustment = null, calculation = null }) {
  let code;
  if (workDate > today) code = "future";
  else if (!isBusinessDate) code = "weekend";
  else if (leave) code = leave.full ? "leave_full" : "leave_half";
  else if (business) code = "business";
  else if (online && !log?.check_in && !log?.check_out) code = "online";
  else if (log?.check_in && log?.check_out && !calculation?.late && !calculation?.early) code = "present";
  else if (log?.check_in || log?.check_out) code = "incomplete";
  else code = "absent";
  const [symbol, baseLabel, defaultWorkday] = labels[code];
  const workday = adjustment ? Number(adjustment.workday) : calculation?.workday ?? defaultWorkday;
  return { code, symbol, label: `${baseLabel}${adjustment ? " (điều chỉnh)" : ""}`, workday };
}

export const ATTENDANCE_DAY_STATUS_LABELS = Object.fromEntries(Object.entries(labels).map(([code, [, label]]) => [code, label]));
