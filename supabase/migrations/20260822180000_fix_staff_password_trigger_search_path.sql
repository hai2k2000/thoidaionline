begin;

create or replace function public.ensure_staff_password_hash()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
begin
  if new.password_hash is null or new.password_hash = '' then
    new.password_hash := extensions.crypt('123456', extensions.gen_salt('bf', 12));
  end if;
  new.password := null;
  return new;
end;
$function$;

alter function public.ensure_staff_password_hash() owner to postgres;
commit;
