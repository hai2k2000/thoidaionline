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
  assert.deepEqual([...sql.matchAll(/create or replace function public\.(\w+)/g)].map((m) => m[1]), Object.keys(sources));
  for (const [name, source] of Object.entries(sources)) {
    let expected = body(read(source), name);
    if (name === "api_assign_task_v2") expected = expected.replace("or p_due_date is null or p_due_time is null", "or (p_recurrence_frequency is not null and p_due_date is null)");
    if (name === "api_register_journalism_task_v1") expected = expected.replace("     or p_due_date is null or p_due_time is null\n", "");
    if (name === "api_assign_task_v2" || name === "api_register_journalism_task_v1") expected = expected.replace("begin\n", "begin\n  p_due_time := case when p_due_date is null then null else coalesce(p_due_time,time '17:00') end;\n");
    if (name === "api_assign_task_batch_v1") expected = expected.replace("       or nullif(v_item->>'due_date', '') is null\n       or nullif(v_item->>'due_time', '') is null then", "       then");
    if (name === "api_assign_task_batch_v1") expected = expected.replace("    if v_recurrence_frequency is not null and v_recurrence_frequency not in ('daily', 'weekly', 'monthly') then", "    if v_recurrence_frequency is not null and v_due_date is null then\n      raise exception 'Recurrence requires a due date at ordinal %.', v_ordinal using errcode='22023';\n    end if;\n    if v_recurrence_frequency is not null and v_recurrence_frequency not in ('daily', 'weekly', 'monthly') then");
    if (name === "api_change_assigned_task_deadline") expected = expected.replace("set due_date=p_new_due_date,updated_at=now()", "set due_date=p_new_due_date,due_time=coalesce(due_time,time '17:00'),updated_at=now()");
    assert.equal(body(sql, name), expected, name);
    for (const statement of read(source).matchAll(new RegExp(`(?:revoke|grant|alter function)[^;]*public\\.${name}\\([^;]+;`, "g"))) assert.ok(sql.includes(statement[0]), statement[0]);
  }
});
