import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as display from "./taskAssignmentDisplay.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
test("entered-by display is secondary and leaves the chosen assigner intact", () => {
  const task = { created_by: "leader", created_by_user: { full_name: "Leader" }, assignment_source: "leadership_assigned", entered_by: "admin", entered_by_user: { full_name: "Administrator" } };
  assert.equal(display.resolveDisplayedAssigner(task).value, "Leader");
  assert.equal(display.getEnteredByDisplay(task), "Admin nhập thay: Administrator");
  assert.equal(display.getEnteredByDisplay({ ...task, entered_by: null }), null);
});
test("repository forwards on behalf identity for single and batch", () => {
  const source = read("./taskRepository.ts");
  assert.equal((source.match(/p_on_behalf_of: input.onBehalfOfId/g) ?? []).length, 2);
});
test("admin-only selector precedes recipient selection and payload carries its value", () => {
  const source = read("../components/TaskAssignShell.tsx");
  assert.match(source, /const onBehalfMode = actorRoleCode === "admin"/);
  assert.match(source, /onBehalfMode &&[\s\S]*?Người giao việc/);
  assert.ok(source.indexOf('label="Người giao việc"') < source.indexOf("<CanonicalAssignmentForm"));
  assert.match(source, /onBehalfOfId[\s\S]*?Chọn người giao việc\./);
  assert.match(source, /\.\.\.payload, onBehalfOfId/);
  assert.match(source, /key=\{onBehalfOfId/);
});
test("migration replaces signatures and checks actor and chosen assigner", () => {
  const sql = read("../../supabase/migrations/20261104130000_task_assignment_on_behalf.sql");
  assert.match(sql, /add column if not exists entered_by uuid references public.staff_users\(id\)/i);
  assert.match(sql, /p_on_behalf_of uuid default null/i);
  assert.match(sql, /v_caller_role is distinct from 'admin'/i);
  assert.match(sql, /api_assert_task_action\(v_assigner_id,null,'assign'\)/i);
  assert.match(sql, /where u.id=v_assigner_id and u.active=true/i);
  assert.match(sql, /drop function if exists public.api_assign_task_v2\(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid\[\],uuid\[\],text,date,text\)/i);
  assert.match(sql, /grant execute on function public.api_assign_task_v2\(uuid,text,text,uuid,uuid,uuid,date,time,text,uuid\[\],uuid\[\],text,date,text,uuid\) to service_role/i);
  assert.match(sql, /drop function if exists public.api_assign_task_batch_v1\(uuid,uuid,uuid,uuid,jsonb\)/i);
  assert.match(sql, /grant execute on function public.api_assign_task_batch_v1\(uuid,uuid,uuid,uuid,jsonb,uuid\)/i);
});
