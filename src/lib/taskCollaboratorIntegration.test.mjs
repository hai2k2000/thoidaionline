import { loadDepartmentLeaderIds } from './taskDepartmentLeaders.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import { parseTaskListSearchParams, taskListHref } from "./taskFilters.mjs";

async function loadModule(file, db) {
  globalThis.__collaboratorTestDb = db;
  let source = readFileSync(file, "utf8").replace('import "server-only";', '').replace('import { serverSupabase } from "@/lib/serverSupabase";', 'const serverSupabase = globalThis.__collaboratorTestDb;');
  source = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  source = source.replace(/from "@\/lib\/([^\"]+)"/g, (_, name) => `from "${pathToFileURL(resolve('src/lib', /\.(mjs|ts)$/.test(name) ? name : `${name}.ts`)).href}"`);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Math.random()}`);
}

test("options expose all active staff with department labels without widening assignees", async () => {
  const rows = [
    { id: "manager", username: "manager", full_name: "Manager", department_id: "a", active: true, roles: { code: "truong_phong" }, job_titles: null },
    { id: "other", username: "other", full_name: "Other", department_id: "b", active: true, roles: { code: "phong_vien" }, job_titles: null },
    { id: "admin", username: "admin", full_name: "Admin", department_id: "b", active: true, roles: { code: "admin" }, job_titles: null },
    { id: "inactive", username: "inactive", full_name: "Inactive", department_id: "b", active: false, roles: { code: "phong_vien" }, job_titles: null },
  ];
  const db = { from(table) { let data = table === "staff_users" ? rows : [{ id: "a", name: "A", active: true, manager_id: "manager" }, { id: "b", name: "B", active: true, manager_id: "other" }]; const q = { select() { return q; }, eq(key, value) { data = data.filter(row => row[key] === value); return q; }, order() { return q; }, then(done) { done({ data, error: null }); } }; return q; } };
  const { taskAssignmentRepository } = await loadModule('src/lib/taskAssignmentRepository.ts', db);
  const result = await taskAssignmentRepository.options({ id: "manager", roleCode: "truong_phong", departmentId: "a" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.people.map(p => p.id), ["manager"]);
  assert.deepEqual(result.collaboratorCandidates.map(p => [p.id, p.departmentName]), [["manager", "A"], ["other", "B"]]);
});

test("cross-department collaborators receive assignment, comment and deadline-change notifications", async () => {
  const now = new Date().toISOString();
  const db = { from(table) { const filters = []; const q = new Proxy({}, { get(_target, method) {
    if (method === "then") return done => {
      let data = [];
      if (table === "task_assignees") data = [{ task_id: "task", assignment_role: "assignee", assigned_at: now }];
      if (table === "tasks" && filters.some(([op]) => op === "in")) data = [{ id: "task", title: "Other department", assignee_id: "owner", owner_id: "owner", created_at: now, updated_at: now, status: "in_progress", due_date: null }];
      if (table === "task_comments") data = [{ id: "comment", task_id: "task", user_id: "owner", content: "Hello", created_at: now }];
      if (table === "task_deadline_history") data = [{ id: "deadline", task_id: "task", changed_by: "manager", new_due_date: "2026-12-01", changed_at: now }];
      done({ data, error: null });
    };
    return (...args) => { filters.push([method, ...args]); return q; };
  } }); return q; } };
  const { notificationRepository } = await loadModule('src/lib/notificationRepository.ts', db);
  const result = await notificationRepository.list("collaborator");
  assert.equal(result.ok, true);
  assert.deepEqual(result.items.map(item => item.kind).sort(), ["assignment", "comment", "deadline_change"]);
  assert.ok(result.items.every(item => item.href === "/tasks/task"));
});

test("collaboration filter round trips with project filter and leaves default all view unchanged", () => {
  const query = parseTaskListSearchParams(new URLSearchParams("scope=collaborating&projectId=none"));
  assert.equal(query.scope, "collaborating");
  assert.match(taskListHref(query, { page: 2 }), /scope=collaborating/);
  assert.equal(query.projectId, "none");
  assert.equal(parseTaskListSearchParams(new URLSearchParams()).scope, "all");
});

test("picker wiring uses all-staff candidates, keeps watchers scoped and projects member-only", () => {
  const form = readFileSync('src/components/CanonicalAssignmentForm.tsx', 'utf8');
  assert.match(form, /const collaboratorPeople = projectMode \? people : collaboratorCandidates \?\? scopedPeople/);
  assert.match(form, /people=\{collaboratorCandidates\.filter\(\(person\) => person\.id !== selectedAssigneeId\)\} selected=\{card\.collaboratorIds\}/);
  assert.match(form, /people=\{people\.filter\(\(person\) => person\.id !== selectedAssigneeId && !card\.collaboratorIds\.includes\(person\.id\)\)\}/);
  const route = readFileSync('src/app/api/tasks/assign/route.ts', 'utf8');
  assert.match(route, /options\(assigner.actor\)/);
  assert.match(route, /apiJson\(\{ \.\.\.options/);
  const sql = readFileSync('supabase/migrations/20261103200000_projects_v1_2_permissions.sql', 'utf8');
  assert.match(sql, /All project participants must be active members/);
});

test("collaboration query filters participant role and excludes owners without a department condition", () => {
  const source = readFileSync('src/lib/taskRepository.ts', 'utf8');
  const branch = source.split('query.scope === "collaborating"')[1].split('query.scope === "department_collaborating"')[0];
  assert.match(branch, /\.eq\("user_id", actor.id\)\.eq\("assignment_role", "assignee"\)/);
  assert.match(branch, /owner_id.is.null,owner_id.neq/);
  assert.match(branch, /assignee_id.is.null,assignee_id.neq/);
  assert.doesNotMatch(branch, /department_id/);
  assert.match(source, /if \(taskIds.length > 0\) \{\s*terms.push\(`id.in./);
});

test("department collaboration scope is leader-only and excludes same-department/project work", () => {
  const query = parseTaskListSearchParams(new URLSearchParams("scope=department_collaborating&page=2"));
  assert.equal(query.scope, "department_collaborating");
  assert.match(taskListHref(query, { page: 3 }), /scope=department_collaborating/);
  const source = readFileSync('src/lib/taskRepository.ts', 'utf8');
  const branch = source.split('query.scope === "department_collaborating"')[1].split('query.scope === "watching"')[0];
  assert.match(branch, /loadDepartmentLeaderIds/);
  assert.match(branch, /assignment_role.*assignee/);
  assert.match(branch, /project_id/);
  assert.match(branch, /department_id/);
});

test("department scope permits primary managers and deputies but rejects mere permission holders", async () => {
  const source = readFileSync('src/lib/taskRepository.ts', 'utf8');
  const body = source.split('query.scope === "department_collaborating") {')[1].split('    } else if (query.scope === "watching")')[0];
  const compiled = ts.transpileModule(`async function run(actor, query, serverSupabase, dbQuery, ok, fail) { ${body}; return ok({ matched: true }); }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const run = new Function("loadDepartmentLeaderIds", `${compiled}; return run;`)(loadDepartmentLeaderIds);
  for (const primary of [false, true, "deputy"]) {
    const calls = [];
    const db = { from(table) {
      const filters = [];
      const q = new Proxy({}, { get(_target, method) {
        if (method === "then") return done => {
          calls.push([table, filters]);
          const data = table === "departments" ? (primary ? [{ id: "managed", active: true, manager_id: primary === true ? "actor" : "manager" }] : []) : table === "staff_users" ? {active: true, department_id: "managed", roles: {code: primary === "deputy" ? "pho_truong_phong" : "nhan_vien", active: true}} : [{ task_id: "foreign-task" }, { task_id: "foreign-task" }];
          done({ data, error: null });
        };
        return (...args) => { filters.push([method, ...args]); return q; };
      } }); return q;
    } };
    const predicates = [];
    const dbQuery = { in(...args) { predicates.push(["in", ...args]); return this; }, is(...args) { predicates.push(["is", ...args]); return this; } };
    const result = await run({ id: "actor", isDepartmentManager: true, departmentId: "managed" }, { page: 2, pageSize: 25 }, db, dbQuery, data => ({ ok: true, data }), error => ({ ok: false, error }));
    assert.equal(result.ok, true);
    assert.ok(calls.some(([table, filters]) => table === "departments" && filters.some(([op, key, value]) => op === "eq" && key === "active" && value === true)));
    if (!primary) {
      assert.deepEqual(result.data, { items: [], total: 0, page: 2, pageSize: 25 });
      assert.equal(calls.length, 2);
      assert.equal(predicates.length, 0);
    } else {
      const filters = calls.find(([table]) => table === "task_assignees")[1];
      for (const predicate of [["eq", "assignment_role", "assignee"], ["eq", "staff_users.department_id", "managed"], ["neq", "tasks.department_id", "managed"], ["is", "tasks.project_id", null]]) assert.ok(filters.some(value => JSON.stringify(value) === JSON.stringify(predicate)));
      assert.deepEqual(predicates, [["in", "id", ["foreign-task"]], ["is", "project_id", null]]);
    }
  }
  assert.ok(source.indexOf('dbQuery.or(scope.data.join(","))') < source.indexOf('query.scope === "department_collaborating"'));
});

test("manager notification is deduplicated, read-aware and excludes self assignments and includes projects", async () => {
  const now = new Date().toISOString();
  for (const recipient of ["manager", "deputy"]) for (const selfField of [null, "assignee_id", "owner_id", "created_by", "project_id"]) {
    const calls = [];
    const db = { from(table) {
      const filters = [];
      const q = new Proxy({}, { get(_target, method) {
        if (method === "then") return done => {
          calls.push([table, filters]);
          let data = [];
          if (table === "departments") data = [{ id: "department", active: true, manager_id: "manager" }];
          if (table === "staff_users") data = {active: true, department_id: "department", job_titles: {code: recipient === "deputy" ? "pho_truong_phong" : "nhan_vien", active: true}};
          if (table === "task_assignees") {
            if (filters.some(([op, key]) => op === "eq" && key === "user_id")) data = [{ task_id: "task", assignment_role: "watcher", assigned_at: now }];
            else data = Array(2).fill({ task_id: "task", user_id: "staff", assigned_at: now, staff_users: { full_name: "An" } });
          }
          if (table === "tasks") data = [{ id: "task", title: "Test", project_id: null, created_at: now, due_date: null, ...(selfField ? { [selfField]: recipient } : {}) }];
          if (table === "user_notification_reads") data = [{ notification_key: `department-collaboration:task:staff:${recipient}` }];
          done({ data, error: null });
        };
        return (...args) => { filters.push([method, ...args]); return q; };
      } }); return q;
    } };
    const { notificationRepository } = await loadModule('src/lib/notificationRepository.ts', db);
    const result = await notificationRepository.list(recipient);
    assert.equal(result.ok, true);
    const events = result.items.filter(item => item.kind === "department_collaboration");
    assert.equal(events.length, selfField && selfField !== "project_id" ? 0 : 1);
    if (!selfField) {
      assert.equal(events[0].message, 'Nhân viên An của phòng bạn được thêm phối hợp vào việc “Test”');
      assert.equal(events[0].unread, false);
      assert.equal(events[0].href, "/tasks/task");
      const filters = calls.find(([table, filters]) => table === "task_assignees" && filters.some(([op]) => op === "gte"))[1];
      assert.ok(filters.some(([op, key, value]) => op === "neq" && key === "user_id" && value === recipient));
      assert.ok(filters.some(([op, key]) => op === "gte" && key === "assigned_at"));
    }
  }
});


test("assignment options retain managers in their real department and leadership; server validates both", async () => {
  const rows = [
    { id: "manager", username: "manager", full_name: "Test Manager", department_id: "a", active: true, roles: { code: "nhan_vien" }, job_titles: { code: "truong_phong" } },
    { id: "deputy", username: "deputy", full_name: "Test Deputy", department_id: "a", active: true, roles: { code: "pho_tong_bien_tap" }, job_titles: null },
    { id: "member", username: "member", full_name: "Test Member", department_id: "a", active: true, roles: { code: "phong_vien" }, job_titles: null },
  ];
  const departments = [{ id: "a", code: "a", name: "A", active: true, manager_id: "manager" }, { id: "board", code: "leadership", name: "Board", active: true, manager_id: "deputy" }];
  const db = { from(table) {
    let data = table === "staff_users" ? rows : departments;
    let single = false;
    const q = { select() { return q; }, eq(key, value) { data = data.filter(row => row[key] === value); return q; }, order() { return q; }, maybeSingle() { single = true; return q; }, then(done) { done({ data: single ? data[0] ?? null : data, error: null }); } };
    return q;
  } };
  const { taskAssignmentRepository: repo } = await loadModule('src/lib/taskAssignmentRepository.ts', db);
  const actor = { id: "deputy", roleCode: "pho_tong_bien_tap", departmentId: "a" };
  const options = await repo.options(actor);
  for (const id of ["manager", "deputy"]) {
    const person = options.people.find(person => person.id === id);
    assert.equal(person.departmentId, "a");
    assert.deepEqual(person.memberDepartmentIds, ["a", "board"]);
  }
  const managerId = options.departments.find(department => department.id === "a").managerId;
  assert.equal(options.people.find(person => person.id === managerId).canReview, true);
  for (const departmentId of ["a", "board"]) {
    const result = await repo.resolveParticipants(actor, { departmentId, assigneeId: "manager", reviewerId: departmentId === "a" ? managerId : "deputy", collaboratorIds: [], watcherIds: [], groupDepartmentId: null, excludedMemberIds: [] });
    assert.equal(result.ok, true);
    const group = await repo.resolveParticipants(actor, { departmentId, assigneeId: "deputy", reviewerId: "deputy", collaboratorIds: [], watcherIds: [], groupDepartmentId: departmentId, excludedMemberIds: [] });
    assert.equal(group.ok, true);
    assert.deepEqual(group.collaboratorIds, departmentId === "a" ? ["member"] : ["manager"]);
  }
  const denied = await repo.resolveParticipants({ ...actor, roleCode: "truong_phong" }, { departmentId: "board", assigneeId: "manager", reviewerId: "deputy", collaboratorIds: [], watcherIds: [], groupDepartmentId: null, excludedMemberIds: [] });
  assert.equal(denied.ok, false);
});

test("assignment client filters membership and retains the selected department", () => {
  for (const file of ['CanonicalAssignmentForm.tsx', 'TaskAssignShell.tsx']) {
    const source = readFileSync('src/components/' + file, 'utf8');
    assert.match(source, /person\.memberDepartmentIds \?\? \[person\.departmentId\]/);
    assert.match(source, /\.includes\(departmentId\)/);
  }
  const form = readFileSync('src/components/CanonicalAssignmentForm.tsx', 'utf8');
  const body = form.split('const chooseRecipient = (person: AssignmentPerson) => {')[1].split('  };')[0];
  const choose = new Function('person', 'departmentId', 'setDepartmentId', 'setAssigneeId', 'setExcludedMemberIds', 'setChoosingOtherDepartment', 'setRecipientPickerOpen', 'setRecipientSearch', 'setFormActivated', 'setBatchId', 'resetTransientState', body);
  for (const [person, current, expected] of [
    [{ id: 'manager', departmentId: 'a', memberDepartmentIds: ['a', 'board'] }, 'board', 'board'],
    [{ id: 'manager', departmentId: 'a', memberDepartmentIds: ['a', 'board'] }, 'a', 'a'],
    [{ id: 'member', departmentId: 'a' }, 'board', 'a'],
    [{ id: 'leader', departmentId: null, memberDepartmentIds: ['board'] }, 'board', 'board'],
  ]) {
    let selected;
    choose(person, current, value => { selected = value; }, ...Array(9).fill(() => {}));
    assert.equal(selected, expected);
  }
});
