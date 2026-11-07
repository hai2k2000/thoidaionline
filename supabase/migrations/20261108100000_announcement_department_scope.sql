begin;
alter table public.announcements add column if not exists department_id uuid references public.departments(id);
create index if not exists announcements_department_idx on public.announcements(department_id,created_at desc) where deleted_at is null;
notify pgrst, 'reload schema';
commit;
