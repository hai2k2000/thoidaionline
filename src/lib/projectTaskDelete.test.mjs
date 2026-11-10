import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const route = readFileSync('src/app/api/projects/[id]/tasks/route.ts', 'utf8');
const repo = readFileSync('src/lib/projectRepository.ts', 'utf8');
const ui = readFileSync('src/components/ProjectDetailShell.tsx', 'utf8');
const migration = 'supabase/migrations/20261105200000_project_cancelled_task_delete.sql';
const sql = existsSync(migration) ? readFileSync(migration, 'utf8') : '';
const linkSql = readFileSync('supabase/migrations/20261110120000_task_link_attachments.sql', 'utf8');

test('project task delete route validates ids and maps RPC errors', () => {
  assert.match(route, /export async function DELETE/);
  assert.match(route, /taskIds/);
  assert.match(route, /asUuid/);
  assert.match(route, /deleteCancelledTasks/);
  assert.match(route, /55000/);
});
test('repository exposes the project cancelled delete RPC', () => {
  assert.match(repo, /deleteCancelledTasks/);
  assert.match(repo, /api_delete_cancelled_project_tasks/);
});
test('UI gates permanent delete to cancelled view and lead/admin', () => {
  assert.match(ui, /isLead/);
  assert.match(ui, /cancelled/);
  const dialog = readFileSync('src/components/ProjectTaskDeleteDialog.tsx', 'utf8');
  assert.match(dialog, /Xóa vĩnh viễn/);
  assert.match(dialog, /Thao tác này xóa vĩnh viễn công việc, trao đổi, tiến độ và tệp đính kèm. Không thể khôi phục\./);
  for (const token of ['showModal()', 'onCancel=', 'aria-labelledby', 'aria-describedby', '.focus()', 'slice(0, 10)', 'Hủy']) assert.ok(dialog.includes(token), token);
  assert.equal(ui.split('onClick={()=>confirmDelete([task])}').length-1, 2);
  assert.match(ui, /confirmDelete\(visibleTasks\.filter\(task=>task.status==='cancelled'\)\)/);
});
test('migration is security-definer, all-or-nothing and handles task references', () => {
  for (const token of ['api_delete_cancelled_project_tasks','security definer','api_project_is_lead','cancelled','for update','audit_logs','task_progress_reports','task_attachments','task_deadline_history','department_plan_items','project_library_items','journalism_task_details','task_recurrence_occurrences','revoke all','grant execute on function']) assert.match(sql, new RegExp(token, 'i'), token);
});
test('migration validates the entire locked batch before audit and deletion, with exact service ACL', () => {
  assert.match(sql,/api_delete_cancelled_project_tasks\(p_actor_id uuid, p_project_id uuid, p_task_ids uuid\[\]\)/);
  assert.match(sql,/returns jsonb language plpgsql security definer set search_path=public,pg_temp/);
  assert.match(sql,/cardinality\(p_task_ids\) > 100/);
  assert.match(sql,/array_agg\(distinct x\)/);
  assert.ok(sql.indexOf('order by id for update')<sql.indexOf('Every task must be'));
  assert.ok(sql.indexOf('Every task must be')<sql.indexOf('insert into public.audit_logs'));
  assert.ok(sql.indexOf('insert into public.audit_logs')<sql.indexOf('delete from public.'));
  assert.match(sql,/t.project_id=p_project_id and t.status='cancelled'/);
  assert.match(sql,/v_status<>'active'[\s\S]*r.code='admin'/);
  assert.match(sql,/revoke all on function public.api_delete_cancelled_project_tasks\(uuid,uuid,uuid\[\]\) from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public.api_delete_cancelled_project_tasks\(uuid,uuid,uuid\[\]\) to service_role/);
  assert.match(sql,/alter function public.api_delete_cancelled_project_tasks\(uuid,uuid,uuid\[\]\) owner to postgres/);
  assert.doesNotMatch(sql,/alter table[\s\S]*foreign key/i);
});
test('inventory scans every migration and every direct task FK has explicit deletion or existing cascade/set-null handling', () => {
  const actual = new Map();
  for (const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) {
    const source=readFileSync(`supabase/migrations/${file}`,'utf8').replace(/--[^\n]*/g,'');
    for (const statement of source.split(';')) {
      for (const ref of statement.matchAll(/references\s+(?:public\.)?tasks\s*\(\s*id\s*\)(\s+on\s+delete\s+(?:cascade|set\s+null|restrict))?/gi)) {
        const before=statement.slice(0,ref.index);
        const table=[...before.matchAll(/(?:create\s+table\s+(?:if\s+not\s+exists\s+)?|alter\s+table\s+)(?:public\.)?(\w+)/gi)].at(-1)?.[1];
        assert.ok(table, `${file}: unresolved task FK`);
        const column=before.match(/foreign\s+key\s*\(\s*(\w+)\s*\)\s*$/i)?.[1] ?? before.match(/(\w+)\s+uuid\s+(?:(?:not\s+null|primary\s+key|unique)\s+)*$/i)?.[1];
        assert.ok(column, `${file}: unresolved FK column`);
        actual.set(`${table}.${column}`, (ref[1]??'no action').trim().replace(/\s+/g,' ').toLowerCase());
      }
    }
  }
  const cascades=['notifications.task_id','task_assignees.task_id','task_comments.task_id','task_progress_logs.task_id'];
  const explicit=['task_links','task_deadline_history','task_progress_reports','task_status_events','task_attachments','task_recurrence_occurrences','task_evaluation_checkpoints','task_qualitative_evaluations','duty_task_reviews','task_completion_scores','journalism_task_details'];
  assert.deepEqual([...actual.keys()].sort(), ['tasks.parent_task_id',...cascades,...explicit.map(t=>`${t}.task_id`),'department_plan_items.linked_task_id','project_library_items.source_task_id'].sort());
  for(const fk of cascades)assert.equal(actual.get(fk),'on delete cascade');
  assert.equal(actual.get('tasks.parent_task_id'),'on delete set null');
  for(const table of explicit)assert.ok((sql + linkSql).includes(`delete from public.${table} where task_id=any(p_task_ids)`),table);
  assert.match(sql,/update public.department_plan_items set linked_task_id=null/);
  assert.ok(sql.indexOf('delete from public.project_library_items')<sql.indexOf('delete from public.task_attachments'));
  assert.match(sql,/source_attachment_id in \(select id from public.task_attachments/);
});
test('storage candidates include library files, deduplicate and preserve surviving references', () => {
  assert.match(sql,/array_agg\(distinct storage_path\)/);
  assert.match(sql,/union select storage_path from public.project_library_items/);
  for(const table of ['project_library_items','task_attachments'])assert.ok(sql.includes(`not exists(select 1 from public.${table} where storage_path=path)`));
  assert.doesNotMatch(sql,/delete from public.project_library_folders/);
});
test('plan unlink exception is limited to postgres, project context and a link-only update; context is restored', () => {
  for(const token of ["current_user='postgres'", "current_setting('thoidai.project_task_delete',true)", "(to_jsonb(p_old)-'linked_task_id')=(to_jsonb(p_new)-'linked_task_id')", "t.status='cancelled'", "a.action='hard_delete'", "coalesce(v_previous_context,'')"])assert.ok(sql.includes(token),token);
});
