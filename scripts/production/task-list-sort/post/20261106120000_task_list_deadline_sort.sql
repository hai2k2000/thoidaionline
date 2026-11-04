-- Fail closed if a pre-existing object with the same name has the wrong type or index shape.
select case when
  (select count(*) from pg_attribute
   where attrelid='public.tasks'::regclass and attgenerated='s' and not attisdropped
     and ((attname='list_closed' and atttypid='boolean'::regtype)
       or (attname='list_due_at' and atttypid='timestamp without time zone'::regtype)
       or (attname='list_priority_rank' and atttypid='smallint'::regtype)))=3
  and exists (
    select 1 from pg_index i join pg_class c on c.oid=i.indexrelid
    join pg_am am on am.oid=c.relam
    where i.indrelid='public.tasks'::regclass
      and c.oid=to_regclass('public.tasks_list_deadline_order_idx')
      and am.amname='btree' and i.indisvalid and i.indisready
      and i.indpred is null and i.indexprs is null and i.indnatts=4
      and pg_get_indexdef(i.indexrelid,1,true)='list_closed'
      and pg_get_indexdef(i.indexrelid,2,true)='list_due_at'
      and pg_get_indexdef(i.indexrelid,3,true)='created_at'
      and pg_get_indexdef(i.indexrelid,4,true)='id'
      and i.indoption::text='0 0 3 0'
  )
  and not exists (
    select 1 from public.tasks
    where list_closed is distinct from (status in ('done','cancelled'))
       or list_due_at is distinct from (due_date + coalesce(due_time,time '23:59'))
       or list_priority_rank is distinct from
         (case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end)
  )
then 'pass' else 'fail' end;
