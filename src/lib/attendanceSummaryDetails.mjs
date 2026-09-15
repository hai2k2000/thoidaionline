export const attendanceDetailsForEmployee = (rows, userId, from, to) => rows.filter((row) => row.user_id === userId && row.work_date >= from && row.work_date <= to);
