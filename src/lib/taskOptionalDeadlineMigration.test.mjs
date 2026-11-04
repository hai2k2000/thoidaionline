import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../supabase/migrations/", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8").replace(/\r\n/g, "\n");
const sources = {
  api_assign_task_v2: "20260928140000_tbt_any_assignee.sql",
  api_assign_task_batch_v1: "20260925111000_task_assignment_batch_rpc.sql",
  api_register_journalism_task_v1: "20260925100000_journalism_self_registration.sql",
  api_change_assigned_task_deadline: "20260930110000_global_task_creator_mutation_policy.sql",
};
const body = (sql, name) => sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$function\\$;`, "i"))?.[0];
test("optional deadline migration preserves function bodies and ACL except explicit deadline edits", () => {
  const sql = read("20261104120000_task_assignment_optional_deadline.sql");
  assert.deepEqual([...sql.matchAll(/create or replace function public\.(\w+)/g)].map((m) => m[1]), [...Object.keys(sources), "api_assign_project_task"]);
  for (const [name, source] of Object.entries(sources)) {
    let expected = body(read(source), name);
    if (name === "api_assign_task_v2") expected = expected.replace("or p_due_date is null or p_due_time is null", "or (p_recurrence_frequency is not null and p_due_date is null)");
    if (name === "api_register_journalism_task_v1") expected = expected.replace("     or p_due_date is null or p_due_time is null\n", "");
    if (name === "api_assign_task_v2" || name === "api_register_journalism_task_v1") expected = expected.replace("begin\n", "begin\n  p_due_time := case when p_due_date is null then null else coalesce(p_due_time,time '17:00') end;\n");
    if (name === "api_assign_task_batch_v1") expected = expected.replace("       or nullif(v_item->>'due_date', '') is null\n       or nullif(v_item->>'due_time', '') is null then", "       then");
    if (name === "api_assign_task_batch_v1") expected = expected.replace("    if v_recurrence_frequency is not null and v_recurrence_frequency not in ('daily', 'weekly', 'monthly') then", "    if v_recurrence_frequency is not null and v_due_date is null then\n      raise exception 'Recurrence requires a due date at ordinal %.', v_ordinal using errcode='22023';\n    end if;\n    if v_recurrence_frequency is not null and v_recurrence_frequency not in ('daily', 'weekly', 'monthly') then");
    if (name === "api_change_assigned_task_deadline") {
      expected = expected.replace("declare v_before public.tasks; v_after public.tasks;\nbegin\n  v_before := public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'edit');\n", "declare v_before public.tasks; v_after public.tasks; v_admin boolean;\nbegin\n  select * into v_before from public.tasks where id=p_task_id for update;\n  if not found then raise exception 'Task not found.' using errcode='P0002'; end if;\n  if v_before.project_id is not null then\n    select exists(select 1 from public.staff_users u join public.roles r on r.id=u.role_id where u.id=p_actor_id and u.active and r.active and r.code='admin') into v_admin;\n    if v_before.status='cancelled' or (not v_admin and (v_before.status='done' or not public.api_project_is_lead(p_actor_id,v_before.project_id))) then\n      raise exception 'Project deadline change forbidden.' using errcode='42501';\n    end if;\n  else\n    v_before := public.api_assert_task_creator_mutation(p_actor_id,p_task_id,'edit');\n  end if;\n");
      expected = expected.replace("set due_date=p_new_due_date,updated_at=now()", "set due_date=p_new_due_date,due_time=coalesce(due_time,time '17:00'),updated_at=now()");
    }
    assert.equal(body(sql, name), expected, name);
    for (const statement of read(source).matchAll(new RegExp(`(?:revoke|grant|alter function)[^;]*public\\.${name}\\([^;]+;`, "g"))) assert.ok(sql.includes(statement[0]), statement[0]);
  }
});

test("optional deadline migration appends the project assignment RPC from the latest project definition", () => {
  const sql = read("20261104120000_task_assignment_optional_deadline.sql");
  const source = read("20261103200000_projects_v1_2_permissions.sql");
  const expected = body(source, "api_assign_project_task")
    .replace("begin\n", "begin\n p_due_time := case when p_due_date is null then null else coalesce(p_due_time,time '17:00') end;\n")
    .replace(" or p_due_date is null or p_due_time is null", "");
  assert.equal(body(sql, "api_assign_project_task"), expected);
  for (const statement of source.matchAll(/(?:revoke|grant|alter function)[^;]*public\.api_assign_project_task\([^;]+;/g)) assert.ok(sql.includes(statement[0]), statement[0]);
});
