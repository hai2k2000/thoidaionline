-- Manual revert: retain all project status/history and audit data.
-- This does not manage the migration ledger. Reconcile version 20261105100000
-- separately only after successful revert verification and owner approval.
begin;
drop function if exists public.api_reopen_project(uuid,uuid);
notify pgrst,'reload schema';
commit;
