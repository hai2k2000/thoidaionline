begin;

-- Keep the historical rating/effort columns for compatibility, but make the
-- only persisted aggregate a database-derived score.
alter table public.task_evaluation_checkpoints
  add column if not exists total_score integer
  generated always as (rating * effort_weight) stored;

comment on column public.task_evaluation_checkpoints.total_score is
  'Canonical total score: completion score (rating) multiplied by difficulty score (effort_weight).';

grant select on public.task_evaluation_checkpoints to anon;

commit;
