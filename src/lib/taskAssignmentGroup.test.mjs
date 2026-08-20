import assert from "node:assert/strict";
import test from "node:test";
import { resolveAssignmentSelection } from "./taskAssignmentGroup.ts";

const department = { id: "dep-a", managerId: "manager" };
const people = [
  { id: "manager", departmentId: "dep-a", canReview: true, canReviewOutsideDepartment: false },
  { id: "owner", departmentId: "dep-a", canReview: false, canReviewOutsideDepartment: false },
  { id: "member", departmentId: "dep-a", canReview: false, canReviewOutsideDepartment: false },
  { id: "reviewer", departmentId: "dep-a", canReview: true, canReviewOutsideDepartment: false },
  { id: "outside", departmentId: "dep-b", canReview: true, canReviewOutsideDepartment: false },
  { id: "leader", departmentId: "dep-b", canReview: true, canReviewOutsideDepartment: true },
];
const base = { broad: false, actorDepartmentId: "dep-a", department, people, departmentId: "dep-a", assigneeId: "owner", reviewerId: "reviewer", collaboratorIds: [], watcherIds: [], groupDepartmentId: "dep-a", excludedMemberIds: [] };

test("server expansion uses active visible department membership and dedupes roles", () => {
  const result = resolveAssignmentSelection({ ...base, watcherIds: ["member", "reviewer", "reviewer"] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.collaboratorIds, ["member", "reviewer"]);
  assert.deepEqual(result.ok && result.watcherIds, []);
});

test("broad leaders may select visible cross-department watchers while scoped managers may not", () => {
  assert.equal(resolveAssignmentSelection({ ...base, watcherIds: ["outside"] }).ok, false);
  const broad = resolveAssignmentSelection({ ...base, broad: true, watcherIds: ["outside"] });
  assert.deepEqual(broad.ok && broad.watcherIds, ["outside"]);
});

test("canonical leaders may review across departments but ordinary outsiders cannot", () => {
  assert.equal(resolveAssignmentSelection({ ...base, reviewerId: "leader" }).ok, true);
  assert.equal(resolveAssignmentSelection({ ...base, reviewerId: "outside" }).ok, false);
});

test("group exclusions are validated and primary cannot be excluded", () => {
  assert.equal(resolveAssignmentSelection({ ...base, excludedMemberIds: ["owner"] }).ok, false);
  assert.equal(resolveAssignmentSelection({ ...base, excludedMemberIds: ["outside"] }).ok, false);
  const result = resolveAssignmentSelection({ ...base, excludedMemberIds: ["member"] });
  assert.equal(result.ok, true);
  assert.ok(result.ok && !result.collaboratorIds.includes("member"));
});

test("individual mode is unchanged but rejects invisible or cross-department participants", () => {
  const individual = resolveAssignmentSelection({ ...base, groupDepartmentId: null, collaboratorIds: ["member"], excludedMemberIds: [] });
  assert.deepEqual(individual.ok && individual.collaboratorIds, ["member"]);
  assert.equal(resolveAssignmentSelection({ ...base, groupDepartmentId: null, collaboratorIds: ["outside"], excludedMemberIds: [] }).ok, false);
  assert.equal(resolveAssignmentSelection({ ...base, groupDepartmentId: null, watcherIds: ["outside"], excludedMemberIds: [] }).ok, false);
});

test("missing manager, inactive-equivalent missing people, and wrong group fail closed", () => {
  assert.equal(resolveAssignmentSelection({ ...base, department: { id: "dep-a", managerId: null } }).ok, false);
  assert.equal(resolveAssignmentSelection({ ...base, people: people.filter((person) => person.id !== "member"), collaboratorIds: ["member"], groupDepartmentId: null }).ok, false);
  assert.equal(resolveAssignmentSelection({ ...base, groupDepartmentId: "dep-b" }).ok, false);
});
