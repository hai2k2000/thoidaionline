const emptyCounts = () => ({ tasks: 0, reports: 0, verified: 0, rejected: 0, stale: 0, unverified: 0, overdue: 0 });

function addRow(map, key, name, row, today) {
  const current = map.get(key) ?? { id: key, name, ...emptyCounts() };
  current.tasks += 1;
  if (row.report) {
    current.reports += 1;
    current[row.report.verification_status] += 1;
  } else {
    current.unverified += 0;
  }
  if (row.due_date && row.due_date < today && !["done", "cancelled"].includes(row.status)) current.overdue += 1;
  map.set(key, current);
}

function sortedValues(map) {
  return [...map.values()].sort((left, right) => right.tasks - left.tasks || left.name.localeCompare(right.name, "vi", { sensitivity: "base" }) || left.id.localeCompare(right.id));
}

/**
 * Derive every dashboard metric from already-authorized Journalism task rows.
 * Global task counts are computed once per task; association tables count a task
 * once per distinct Topic/Series association.
 */
export function deriveJournalismReportingMetrics(rows, totalAuthorizedTasks = rows.length, today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()), limits = { recent: 15, attention: 20 }) {
  const byAssignee = new Map();
  const byDepartment = new Map();
  const byTopic = new Map();
  const bySeries = new Map();
  const recentPublications = [];
  const attention = [];
  let reportedPublications = 0;
  let verificationVerified = 0;
  let verificationRejected = 0;
  let verificationStale = 0;
  let verificationUnverified = 0;
  let overdue = 0;

  for (const row of rows) {
    const rowOverdue = Boolean(row.due_date && row.due_date < today && !["done", "cancelled"].includes(row.status));
    if (rowOverdue) overdue += 1;
    if (row.report) {
      reportedPublications += 1;
      const state = row.report.verification_status;
      if (state === "verified") verificationVerified += 1;
      else if (state === "rejected") verificationRejected += 1;
      else if (state === "stale") verificationStale += 1;
      else verificationUnverified += 1;
      recentPublications.push({
        taskId: row.id,
        taskTitle: row.title,
        publishedTitle: row.report.published_title ?? row.title,
        publishedAt: row.report.published_at,
        reporter: row.report.reporter?.full_name ?? "Người dùng",
        verificationStatus: state,
        url: row.report.publication_url,
      });
      if (["unverified", "rejected", "stale"].includes(state)) attention.push({
        taskId: row.id,
        taskTitle: row.title,
        kind: "verification",
        label: state === "rejected" ? "Bị từ chối" : state === "stale" ? "Cần xác minh lại" : "Chưa xác minh",
        verificationStatus: state,
      });
    } else if (rowOverdue) {
      attention.push({ taskId: row.id, taskTitle: row.title, kind: "overdue", label: "Quá hạn chưa ghi nhận xuất bản", verificationStatus: null });
    }

    const assigneeId = row.assignee_id ?? "unassigned";
    addRow(byAssignee, assigneeId, row.assignee?.full_name ?? "Chưa phân công", row, today);
    const departmentId = row.department_id ?? "unassigned";
    addRow(byDepartment, departmentId, row.department?.name ?? "Chưa xác định phòng ban", row, today);
    const topicKeys = new Set();
    for (const topic of (row.topics ?? [])) {
      if (topicKeys.has(topic.id)) continue;
      topicKeys.add(topic.id);
      addRow(byTopic, topic.id, topic.name, row, today);
    }
    const seriesKeys = new Set();
    for (const series of (row.series ?? [])) {
      if (seriesKeys.has(series.id)) continue;
      seriesKeys.add(series.id);
      addRow(bySeries, series.id, series.name, row, today);
    }
  }

  recentPublications.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt) || left.taskId.localeCompare(right.taskId));
  attention.sort((left, right) => left.taskTitle.localeCompare(right.taskTitle, "vi", { sensitivity: "base" }) || left.taskId.localeCompare(right.taskId));
  return {
    totalTasks: totalAuthorizedTasks,
    reportedPublications,
    unreportedTasks: Math.max(0, totalAuthorizedTasks - reportedPublications),
    verificationVerified,
    verificationRejected,
    verificationStale,
    verificationUnverified,
    overdue,
    byAssignee: sortedValues(byAssignee),
    byDepartment: sortedValues(byDepartment),
    byTopic: sortedValues(byTopic),
    bySeries: sortedValues(bySeries),
    recentPublications: recentPublications.slice(0, limits.recent),
    attention: attention.slice(0, limits.attention),
  };
}
