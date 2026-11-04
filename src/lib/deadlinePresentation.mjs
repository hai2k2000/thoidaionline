const labels = {
  on_time: "Đúng hạn",
  due_soon: "Sắp đến hạn",
  overdue: "Quá hạn",
  no_deadline: "Không có hạn",
};

export const deadlineLabel = (state) => labels[state] ?? "Chưa xác định";
