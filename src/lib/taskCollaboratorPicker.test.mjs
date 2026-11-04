import assert from "node:assert/strict";
import test from "node:test";
import { filterCollaboratorCandidates, collaboratorLabel } from "./taskCollaboratorPicker.mjs";

test("collaborator search ignores Vietnamese accents and matches usernames", () => {
  const people = [{ id: "a", fullName: "Đặng Thị Ánh", username: "anh.dang", departmentName: "Biên tập" }, { id: "b", fullName: "Trần Bình", username: "binh", departmentName: "Kỹ thuật" }];
  assert.deepEqual(filterCollaboratorCandidates(people, " dang thi anh ").map(p => p.id), ["a"]);
  assert.deepEqual(filterCollaboratorCandidates(people, "ANH.DANG").map(p => p.id), ["a"]);
  assert.deepEqual(filterCollaboratorCandidates(people, "").map(p => p.id), ["a", "b"]);
  assert.equal(collaboratorLabel(people[0]), "Đặng Thị Ánh · Biên tập");
});
