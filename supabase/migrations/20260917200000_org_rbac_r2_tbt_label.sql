-- R2 narrow reconciliation: correct only the display label for the immutable TBT role code.
-- Production application is intentionally deferred; this file is not run by R2.
begin;

update public.roles
set name = 'Tổng biên tập'
where code = 'tong_bien_tap'
  and name = 'Tổng biên tập (chỉ xem công việc và nhân sự)';

commit;

-- Rollback (run explicitly if ever required):
-- update public.roles
-- set name = 'Tổng biên tập (chỉ xem công việc và nhân sự)'
-- where code = 'tong_bien_tap'
--   and name = 'Tổng biên tập';
