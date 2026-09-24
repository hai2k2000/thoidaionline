import assert from "node:assert/strict";
import test from "node:test";

const printModule = await import("./taskPrintModel.ts").catch(() => ({}));

const baseTask = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Chuẩn bị hồ sơ đối ngoại",
  created_at: "2026-09-24T08:15:00+07:00",
  task_type: "assigned",
  compatibility_task_type: "assigned",
  departments: { name: "Phòng Tổng hợp" },
  created_by_user: { full_name: "Nguyễn Người Giao" },
  owner: { full_name: "Trần Người Nhận" },
  task_assignees: [
    { user_id: "owner", assignment_role: "owner", status: "todo", staff_users: { full_name: "Trần Người Nhận" } },
    { user_id: "collaborator", assignment_role: "assignee", status: "todo", staff_users: { full_name: "Lê Phối Hợp" } },
    { user_id: "watcher", assignment_role: "watcher", status: "todo", staff_users: { full_name: "Phạm Theo Dõi" } },
  ],
  description: "Chuẩn bị tài liệu làm việc.",
  evaluation_criteria: JSON.stringify(["Đủ tài liệu", "Đúng thể thức"]),
  due_date: "2026-09-30",
  due_time: "17:30",
  priority: "high",
  journalism: null,
};

test("print mapping uses assignment domain roles instead of treating watchers as collaborators", () => {
  assert.equal(typeof printModule.buildWorkAssignmentPrintModel, "function");
  const result = printModule.buildWorkAssignmentPrintModel(baseTask);
  assert.equal(result.assigner, "Nguyễn Người Giao");
  assert.equal(result.primaryAssignee, "Trần Người Nhận");
  assert.deepEqual(result.collaborators, ["Lê Phối Hợp"]);
  assert.equal(result.collaborators.includes("Phạm Theo Dõi"), false);
  assert.deepEqual(result.requirements, ["Đủ tài liệu", "Đúng thể thức"]);
});

test("print mapping prefers the task owner before falling back to the primary assignee", () => {
  const result = printModule.buildWorkAssignmentPrintModel({
    ...baseTask,
    assignee_id: "assignee",
    owner_id: "owner",
    owner: { full_name: "Trần Người Nhận" },
    task_assignees: [
      { user_id: "owner", assignment_role: "owner", status: "todo", staff_users: { full_name: "Trần Người Nhận" } },
      { user_id: "assignee", assignment_role: "assignee", status: "todo", staff_users: { full_name: "Vũ Người Được Giao" } },
      { user_id: "collaborator", assignment_role: "assignee", status: "todo", staff_users: { full_name: "Lê Phối Hợp" } },
      { user_id: "watcher", assignment_role: "watcher", status: "todo", staff_users: { full_name: "Phạm Theo Dõi" } },
    ],
  });
  assert.equal(result.primaryAssignee, "Trần Người Nhận");
  assert.deepEqual(result.collaborators, ["Vũ Người Được Giao", "Lê Phối Hợp"]);
});

test("print mapping adds current Journalism metadata without MasterCMS fields", () => {
  assert.equal(typeof printModule.buildWorkAssignmentPrintModel, "function");
  const result = printModule.buildWorkAssignmentPrintModel({
    ...baseTask,
    departments: { name: "Phòng Nội dung" },
    journalism: {
      topics: [{ id: "topic", name: "Đối ngoại", isActive: true, departmentId: "editorial" }],
      series: { id: "series", name: "Việt Nam hội nhập", isActive: true, departmentId: "editorial", topicId: "topic", position: 1 },
      planned_publication_at: "2026-10-02T09:00:00+07:00",
      publication_status: "scheduled",
      editorial_notes: "Ưu tiên ảnh ngang.",
    },
  });
  assert.equal(result.taskType, "Công việc nghiệp vụ báo chí");
  assert.deepEqual(result.journalism.topics, ["Đối ngoại"]);
  assert.equal(result.journalism.series, "Việt Nam hội nhập");
  assert.equal(result.journalism.publicationStatus, "Đã lên lịch");
  assert.equal(result.notes, "Ưu tiên ảnh ngang.");
  assert.equal(Object.hasOwn(result.journalism, "cms"), false);
});
