-- Task assignment no longer exposes or sends priority. Keep the legacy column
-- for backward compatibility and make omitted inserts deterministic.
alter table public.tasks
  alter column priority set default 'normal';

update public.tasks
   set priority = 'normal'
 where priority is null;

alter table public.tasks
  alter column priority set not null;

comment on column public.tasks.priority is
  'Legacy compatibility field; assignment UI/API does not expose or use it. New omitted inserts default to normal.';
