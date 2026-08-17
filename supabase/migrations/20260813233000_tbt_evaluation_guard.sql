-- TBT roles are view-only and must never write evaluations through the
-- SECURITY DEFINER RPC. Admin retains organisation-wide authority; managers
-- may evaluate only tasks where they are the designated reviewer.
create or replace function public.save_task_evaluation_checkpoint(
  p_actor_id uuid,
  p_task_id uuid,
  p_employee_id uuid,
  p_rating integer,
  p_effort_weight integer,
  p_completion text,
  p_on_time boolean,
  p_opinion text,
  p_checkpoint_date date,
  p_is_final boolean
)
returns public.task_evaluation_checkpoints
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_checkpoint public.task_evaluation_checkpoints;
  v_allowed boolean;
begin
  select exists (
    select 1
      from public.staff_users u
      join public.roles r on r.id = u.role_id
      left join public.tasks t on t.id = p_task_id
     where u.id = p_actor_id
       and u.active = true
       and (
         r.code = 'admin'
         or (
           t.reviewer_id = p_actor_id
           and r.code in (
             'pho_tong_bien_tap',
             'phu_trach_phong_tri_su',
             'phu_trach_phong_phong_vien',
             'phu_trach_phong_bien_tap'
           )
         )
       )
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Báº¡n khÃ´ng pháº£i ngÆ°á»i nháº­n bÃ¡o cÃ¡o hoáº·c khÃ´ng cÃ³ quyá»n Ä‘Ã¡nh giÃ¡ cÃ´ng viá»‡c.' using errcode = '42501';
  end if;

  if p_rating not between 1 and 10 then
    raise exception 'Äiá»ƒm Ä‘Ã¡nh giÃ¡ pháº£i tá»« 1 Ä‘áº¿n 10.' using errcode = '22023';
  end if;
  if p_effort_weight not in (1, 2, 3, 5, 8) then
    raise exception 'Trá»ng sá»‘ cÃ´ng viá»‡c khÃ´ng há»£p lá»‡.' using errcode = '22023';
  end if;
  if p_completion not in ('not_done', 'done', 'excellent') then
    raise exception 'Má»©c hoÃ n thÃ nh khÃ´ng há»£p lá»‡.' using errcode = '22023';
  end if;
  if p_checkpoint_date is null then
    raise exception 'NgÃ y Ä‘Ã¡nh giÃ¡ lÃ  báº¯t buá»™c.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.tasks t
     where t.id = p_task_id
       and (
         t.assignee_id = p_employee_id
         or exists (
           select 1 from public.task_assignees ta
            where ta.task_id = t.id
              and ta.user_id = p_employee_id
              and ta.assignment_role <> 'watcher'
         )
       )
  ) then
    raise exception 'NhÃ¢n viÃªn khÃ´ng Ä‘Æ°á»£c giao cÃ´ng viá»‡c nÃ y.' using errcode = '22023';
  end if;

  update public.tasks set effort_weight = p_effort_weight, updated_at = now()
   where id = p_task_id;

  insert into public.task_evaluation_checkpoints (
    task_id, employee_id, reviewer_id, rating, effort_weight,
    completion, on_time, opinion, checkpoint_date, is_final
  ) values (
    p_task_id, p_employee_id, p_actor_id, p_rating, p_effort_weight,
    p_completion, p_on_time, nullif(btrim(p_opinion), ''), p_checkpoint_date, p_is_final
  ) returning * into v_checkpoint;

  return v_checkpoint;
end;
$$;

revoke all on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) from public;
revoke all on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) from anon;
revoke all on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) from authenticated;
grant execute on function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) to service_role;
alter function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) owner to postgres;
alter function public.save_task_evaluation_checkpoint(uuid, uuid, uuid, integer, integer, text, boolean, text, date, boolean) set search_path = public, pg_temp;
