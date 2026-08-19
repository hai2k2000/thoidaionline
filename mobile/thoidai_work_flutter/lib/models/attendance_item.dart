class AttendanceItem {
  const AttendanceItem({
    required this.id,
    required this.workDate,
    this.checkIn,
    this.checkOut,
    this.status,
    this.note,
    this.staffName,
  });

  final String id;
  final String workDate;
  final String? checkIn;
  final String? checkOut;
  final String? status;
  final String? note;
  final String? staffName;

  factory AttendanceItem.fromJson(Map<String, dynamic> json) {
    return AttendanceItem(
      id: json['id'] as String,
      workDate: (json['work_date'] as String?) ?? '',
      checkIn: json['check_in'] as String?,
      checkOut: json['check_out'] as String?,
      status: json['status'] as String?,
      note: json['note'] as String?,
      staffName: (json['staff_users'] as Map<String, dynamic>?)?['full_name'] as String?,
    );
  }
}
