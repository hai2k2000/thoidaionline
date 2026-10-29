export function planManagingRoomChange({ currentAssignment, status, selectedDepartmentId }) {
  if (status === "liquidated" || !selectedDepartmentId) return { action: null, clearsAssignee: false };
  if (!currentAssignment) return { action: "assign", clearsAssignee: false };
  if (currentAssignment.department_id === selectedDepartmentId) return { action: null, clearsAssignee: false };
  return { action: "transfer", clearsAssignee: Boolean(currentAssignment.assignee_id) };
}
