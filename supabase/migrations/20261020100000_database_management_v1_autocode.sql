begin;

create table if not exists public.db_record_code_counters (
  code_year integer primary key check (code_year between 2000 and 9999),
  next_number bigint not null check (next_number > 0)
);

insert into public.db_record_code_counters (code_year, next_number)
select match.year_value, max(match.sequence_value) + 1
from (
  select substring(record_code from '^HS-([0-9]{4})-([0-9]{6})$')::integer as year_value,
         substring(record_code from '^HS-[0-9]{4}-([0-9]{6})$')::bigint as sequence_value
  from public.db_records
  where record_code ~ '^HS-[0-9]{4}-[0-9]{6}$'
) as match
group by match.year_value
on conflict (code_year) do update
set next_number = greatest(public.db_record_code_counters.next_number, excluded.next_number);

create or replace function public.api_next_database_record_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year integer := extract(year from timezone('Asia/Ho_Chi_Minh', now()))::integer;
  allocated_number bigint;
begin
  insert into public.db_record_code_counters (code_year, next_number)
  values (current_year, 2)
  on conflict (code_year) do update
    set next_number = public.db_record_code_counters.next_number + 1
  returning next_number - 1 into allocated_number;

  if allocated_number > 999999 then
    raise exception 'database_record_code_exhausted';
  end if;
  return format('HS-%s-%s', current_year, lpad(allocated_number::text, 6, '0'));
end;
$$;

revoke all on function public.api_next_database_record_code() from public;
grant execute on function public.api_next_database_record_code() to service_role;

commit;
