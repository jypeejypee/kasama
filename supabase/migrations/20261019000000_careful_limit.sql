-- How many replies used the careful (more expensive) model today, per phone.
-- Run once: Supabase → SQL Editor → paste this → Run.

alter table public.usage add column if not exists careful int not null default 0;

-- Uses one careful reply. Returns false when this phone already used today's careful replies;
-- Kasama then answers with the light model instead (it never stops answering because of this).
create or replace function public.use_careful(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update usage set careful = careful + 1
  where user_id = p_user and day = current_date and careful < p_limit;
  return found;
end;
$$;

revoke execute on function public.use_careful(uuid, int) from public, anon, authenticated;
grant execute on function public.use_careful(uuid, int) to service_role;
