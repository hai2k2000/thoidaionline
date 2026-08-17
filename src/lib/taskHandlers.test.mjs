import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repositorySource = readFileSync(
  new URL("./taskRepository.ts", import.meta.url),
  "utf8",
);

test("task repository is server-only and uses the service-role client", () => {
  assert.match(repositorySource, /import "server-only"/);
  assert.match(repositorySource, /serverSupabase/);
  assert.doesNotMatch(repositorySource, /from ["']@\/lib\/supabase["']/);
  assert.doesNotMatch(repositorySource, /select\(["']\*["']/);
});

test("task repository calls only Phase-1 wrapper RPCs for mutations", () => {
  for (const rpc of [
    "api_create_task",
    "api_update_task",
    "api_claim_task_plan",
    "api_report_task_progress",
    "api_review_task_completion",
    "api_save_task_evaluation_checkpoint",
    "api_add_task_comment",
    "api_create_bulk_task_plan",
  ]) {
    assert.match(repositorySource, new RegExp(rpc));
  }
  assert.doesNotMatch(
    repositorySource,
    /\.rpc\(["'](?:claim_task_plan|report_task_progress|review_task_completion|save_task_evaluation_checkpoint|create_bulk_task_plan)["']/,
  );
});

test("task repository selects allowlisted fields and paginates", () => {
  assert.match(repositorySource, /TASK_LIST_FIELDS/);
  assert.match(repositorySource, /TASK_DETAIL_FIELDS/);
  assert.match(repositorySource, /\.range\(from, to\)/);
  assert.match(repositorySource, /task_assignees/);
  assert.match(repositorySource, /task_comments/);
  assert.match(repositorySource, /task_progress_logs/);
  assert.match(repositorySource, /task_evaluation_checkpoints/);
});
import { normalizePermissions } from "./permissions.ts";
import {
  canAssignToDepartment,
  canTaskAction,
} from "./authorization.ts";
import { apiError, apiJson } from "./apiResponse.ts";
import { createTaskApplication } from "./taskHandlerFactory.ts";
import { normalizeLegacyEvaluationInput } from "./legacyEvaluationValidation.ts";

const makeActor = (overrides = {}) => ({
  id: "actor",
  full_name: "Actor",
  email: null,
  username: null,
  department_id: "dep-a",
  role_code: "phong_vien",
  role_name: "Staff",
  role_level: 1,
  active: true,
  permissions: normalizePermissions({ can_comment: true }),
  ...overrides,
});

const access = (overrides = {}) => ({
  id: "00000000-0000-4000-8000-000000000010",
  departmentId: "dep-a",
  createdBy: "creator",
  ownerId: "actor",
  assigneeId: "actor",
  reviewerId: "reviewer",
  selfClaimable: false,
  status: "in_progress",
  participants: [{ userId: "actor", assignmentRole: "owner" }],
  ...overrides,
});

const makeHarness = ({
  readActor = makeActor(),
  mutationActor = makeActor(),
  taskAccess = access(),
} = {}) => {
  const calls = [];
  const result = (data) => Promise.resolve({ ok: true, data });
  const repository = {
    list: (actor, query) => {
      calls.push(["list", actor.id, query]);
      return result({ items: [], total: 0, page: 1, pageSize: 25 });
    },
    access: (taskId) => result(taskAccess && { ...taskAccess, id: taskId }),
    detail: (taskId) => result(taskAccess
      ? { id: taskId, legacy_evaluations: [] }
      : null),
    create: (...args) => { calls.push(["create", ...args]); return result({ id: "new" }); },
    update: (...args) => { calls.push(["update", ...args]); return result({ id: args[1] }); },
    claim: (...args) => { calls.push(["claim", ...args]); return result({}); },
    report: (...args) => { calls.push(["report", ...args]); return result({}); },
    review: (...args) => { calls.push(["review", ...args]); return result({}); },
    evaluate: (...args) => { calls.push(["evaluate", ...args]); return result({}); },
    comment: (...args) => { calls.push(["comment", ...args]); return result({}); },
    bulkPlan: (...args) => { calls.push(["bulkPlan", ...args]); return result({}); },
  };
  const app = createTaskApplication({
    repository,
    readActor: async () => readActor
      ? { ok: true, actor: readActor }
      : { ok: false, response: apiError("unauthenticated", 401) },
    mutationActor: async () => mutationActor
      ? { ok: true, actor: mutationActor }
      : { ok: false, response: apiError("invalid_origin", 403) },
    json: apiJson,
    error: apiError,
    rpcFailure: () => apiError("operation_failed", 500),
    asUuid: (value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
      ? value
      : null,
    canAssignToDepartment,
    canTaskAction,
    normalizeLegacyEvaluationInput,
    newUuid: () => "00000000-0000-4000-8000-000000000099",
  });
  return { app, calls };
};

const taskId = "00000000-0000-4000-8000-000000000010";
const employeeId = "00000000-0000-4000-8000-000000000011";

test("list requires a signed actor and delegates server-side pagination", async () => {
  const denied = makeHarness({ readActor: null });
  assert.equal((await denied.app.list(new Request("https://example.test/api/tasks"))).status, 401);

  const allowed = makeHarness();
  const response = await allowed.app.list(
    new Request("https://example.test/api/tasks?page=1&pageSize=25"),
  );
  assert.equal(response.status, 200);
  assert.equal(allowed.calls[0][0], "list");
});

test("detail denies an unrelated actor before loading the DTO", async () => {
  const harness = makeHarness({
    taskAccess: access({
      createdBy: "other",
      ownerId: "other",
      assigneeId: "other",
      reviewerId: "other",
      participants: [],
      departmentId: "dep-b",
    }),
  });
  assert.equal((await harness.app.detail(taskId)).status, 403);
});

test("TBT can read and comment globally but cannot call other task mutations", async () => {
  const tbt = makeActor({
    role_code: "tong_bien_tap",
    permissions: normalizePermissions({
      can_comment: true,
      can_evaluate_step2: true,
    }),
  });
  const harness = makeHarness({
    readActor: tbt,
    mutationActor: tbt,
    taskAccess: access({
      departmentId: "dep-z",
      createdBy: "other",
      ownerId: "other",
      assigneeId: "other",
      reviewerId: "other",
      participants: [],
    }),
  });
  assert.equal((await harness.app.detail(taskId)).status, 200);
  const request = new Request("https://example.test/api/tasks/report", {
    method: "POST",
    body: JSON.stringify({ taskId, progress: 20, report: "progress" }),
  });
  assert.equal((await harness.app.report(request)).status, 403);
  assert.equal(harness.calls.length, 0);
  const comment = new Request("https://example.test/api/tasks/comments", {
    method: "POST",
    body: JSON.stringify({ content: "global comment" }),
  });
  assert.equal((await harness.app.comment(comment, taskId)).status, 201);
  assert.equal(harness.calls[0][0], "comment");
});

test("mutation body cannot choose actor and assignee can report", async () => {
  const harness = makeHarness();
  const request = new Request("https://example.test/api/tasks/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actorId: "forged",
      taskId,
      progress: 50,
      report: "progress",
      blockers: "",
    }),
  });
  assert.equal((await harness.app.report(request)).status, 200);
  assert.deepEqual(harness.calls[0].slice(0, 3), ["report", "actor", taskId]);
});

test("watcher may comment but may not report", async () => {
  const watcherTask = access({
    ownerId: "owner",
    assigneeId: "assignee",
    participants: [{ userId: "actor", assignmentRole: "watcher" }],
  });
  const harness = makeHarness({ taskAccess: watcherTask });
  const report = new Request("https://example.test/api/tasks/report", {
    method: "POST",
    body: JSON.stringify({ taskId, progress: 10, report: "progress" }),
  });
  const comment = new Request("https://example.test/api/tasks/comments", {
    method: "POST",
    body: JSON.stringify({ content: "comment" }),
  });
  assert.equal((await harness.app.report(report)).status, 403);
  assert.equal((await harness.app.comment(comment, taskId)).status, 201);
});

test("legacy evaluation validates and never grants TBT step2 through the old path", async () => {
  const manager = makeActor({
    id: "reviewer",
    permissions: normalizePermissions({ can_evaluate_step1: true }),
  });
  const harness = makeHarness({
    mutationActor: manager,
    taskAccess: access({ reviewerId: "reviewer" }),
  });
  const invalid = new Request("https://example.test/api/tasks/evaluate", {
    method: "POST",
    body: JSON.stringify({
      taskId,
      employeeId,
      rating: 7.5,
      effortWeight: 3,
      completion: "done",
      onTime: "true",
      opinion: "",
      checkpointDate: "2026-02-30",
      isFinal: true,
    }),
  });
  assert.equal((await harness.app.evaluate(invalid)).status, 400);
  assert.equal(harness.calls.length, 0);
  const request = new Request("https://example.test/api/tasks/evaluate", {
    method: "POST",
    body: JSON.stringify({
      taskId,
      employeeId,
      rating: 8,
      effortWeight: 3,
      completion: "done",
      onTime: true,
      opinion: "",
      checkpointDate: "2026-08-14",
      isFinal: true,
    }),
  });
  assert.equal((await harness.app.evaluate(request)).status, 200);
  assert.equal(harness.calls[0][0], "evaluate");
});

test("list, detail and mutation responses are private no-store at runtime", async () => {
  const harness = makeHarness();
  const responses = [
    await harness.app.list(new Request("https://example.test/api/tasks")),
    await harness.app.detail(taskId),
    await harness.app.report(new Request("https://example.test/api/tasks/report", {
      method: "POST",
      body: JSON.stringify({ taskId, progress: 25, report: "progress" }),
    })),
  ];
  for (const response of responses) {
    assert.match(
      response.headers.get("cache-control") ?? "",
      /private, no-store/,
    );
  }
});
test("route files are thin delegates with no Supabase client", () => {
  for (const relative of [
    "../app/api/tasks/route.ts",
    "../app/api/tasks/[id]/route.ts",
    "../app/api/tasks/[id]/comments/route.ts",
    "../app/api/tasks/claim/route.ts",
    "../app/api/tasks/report/route.ts",
    "../app/api/tasks/review/route.ts",
    "../app/api/tasks/evaluate/route.ts",
    "../app/api/planning/bulk/route.ts",
  ]) {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /taskHandlers/);
    assert.doesNotMatch(source, /serverSupabase|@\/lib\/supabase|\.rpc\(/);
  }
});

test("production handler wiring imports every injected dependency from owned modules", () => {
  const source = readFileSync(
    new URL("./taskHandlers.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /randomUUID/);
  assert.match(source, /canAssignToDepartment/);
  assert.match(source, /canTaskAction/);
  assert.match(source, /normalizeLegacyEvaluationInput/);
  assert.doesNotMatch(source, /taskEvaluation/);
});
