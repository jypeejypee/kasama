-- "Report this reply": AI replies people flagged as offensive or wrong, so you can review them.
-- Run once: Supabase → SQL Editor → paste this → Run (after the earlier migrations).

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  -- Deleting a phone's data ("Delete my data") keeps the report but removes the link to the phone
  user_id uuid references auth.users (id) on delete set null,
  reply text not null check (char_length(reply) <= 2000),
  reason text not null check (reason in ('offensive', 'wrong', 'other')),
  created_at timestamptz not null default now()
);

-- No policies: phones can't read or change reports. Only the Edge Function (service role) can.
-- You read them in Supabase → Table Editor → reports.
alter table public.reports enable row level security;
