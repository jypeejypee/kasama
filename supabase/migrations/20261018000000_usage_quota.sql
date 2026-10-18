-- Daily usage per phone, so nobody can drain the Claude credit.
-- Run once: Supabase → SQL Editor → paste this → Run (or `npx supabase db push`).

create table if not exists public.usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  calls int not null default 0,
  primary key (user_id, day)
);

-- No policies: phones can't read or change this table. Only the Edge Function (service role) can.
alter table public.usage enable row level security;

-- Counts one request. Returns false when this phone, or everyone together, reached today's limit.
create or replace function public.use_credit(p_user uuid, p_limit int, p_global int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  mine int;
  everyone int;
begin
  select coalesce(sum(calls), 0) into everyone from usage where day = current_date;
  if everyone >= p_global then
    return false;
  end if;
  insert into usage (user_id, day, calls) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set calls = usage.calls + 1
  returning calls into mine;
  return mine <= p_limit;
end;
$$;

revoke execute on function public.use_credit(uuid, int, int) from public, anon, authenticated;
grant execute on function public.use_credit(uuid, int, int) to service_role;
