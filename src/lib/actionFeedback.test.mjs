import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => {
  const url = new URL(path, root);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};

const reducer = read("src/lib/actionFeedback.ts");
const provider = read("src/components/ActionFeedbackProvider.tsx");
const layout = read("src/app/layout.tsx");
const users = read("src/app/users/page.tsx");
const reset = read("src/app/reset-password/page.tsx");
const forgot = read("src/app/forgot-password/page.tsx");
const batch2 = ["departments/page.tsx", "job-titles/page.tsx", "assets/new/page.tsx", "assets/[id]/page.tsx", "documents/new/page.tsx", "hr-profiles/[id]/page.tsx"].map((path) => read(`src/app/${path}`));
const batch3 = ["PersonalTaskForm.tsx", "PersonalTaskActions.tsx", "TaskAssignShell.tsx", "TaskDetailShell.tsx", "EmployeeEvaluationShell.tsx", "PersonnelEvaluationDetailShell.tsx", "EvaluationRubricShell.tsx", "DepartmentManagerShell.tsx"].map((path) => read(`src/components/${path}`));

test("feedback reducer supports success, error, timeout and dismiss transitions", () => {
  assert.match(reducer, /export type FeedbackKind/);
  assert.match(reducer, /feedbackReducer/);
  assert.match(reducer, /show/);
  assert.match(reducer, /dismiss/);
  assert.match(reducer, /timeout/);
});

test("feedback provider renders an accessible high-z-index notice and exposes notify", () => {
  assert.match(provider, /ActionFeedbackProvider/);
  assert.match(provider, /useActionFeedback/);
  assert.match(provider, /z-\[100\]/);
  assert.match(provider, /role=\{.*alert.*status/s);
  assert.match(provider, /aria-label/);
});

test("root layout mounts the provider outside page and modal content", () => {
  assert.match(layout, /ActionFeedbackProvider/);
  assert.match(layout, /<ActionFeedbackProvider>[\s\S]*<AuthProvider>[\s\S]*\{children\}/);
});

test("password and user mutations normalize failures and always release busy state", () => {
  assert.match(users, /useActionFeedback/);
  assert.match(users, /setSelected\(null\)/);
  assert.match(users, /finally/);
  assert.match(users, /responseErrorMessage/);
  assert.match(reset, /setBusy/);
  assert.match(reset, /finally/);
  assert.match(forgot, /setBusy/);
  assert.match(forgot, /finally/);
});

test("batch 2 mutation pages use global feedback and release busy state", () => {
  for (const source of batch2) {
    assert.match(source, /useActionFeedback/);
    assert.match(source, /notify\("success"/);
    assert.match(source, /notify\("error"/);
    assert.match(source, /finally/);
  }
});

test("batch 3 mutation shells use global feedback and finally guards", () => {
  for (const source of batch3) {
    assert.match(source, /useActionFeedback/);
    assert.match(source, /notify\("success"/);
    assert.match(source, /notify\("error"/);
    assert.match(source, /finally/);
  }
});
