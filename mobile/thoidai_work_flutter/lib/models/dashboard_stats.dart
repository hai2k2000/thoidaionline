class DashboardStats {
  const DashboardStats({
    required this.totalTasks,
    required this.myTasks,
    required this.overdueTasks,
    required this.hrProfiles,
    required this.assetsInUse,
    required this.documentsOverdue,
  });

  final int totalTasks;
  final int myTasks;
  final int overdueTasks;
  final int hrProfiles;
  final int assetsInUse;
  final int documentsOverdue;
}
