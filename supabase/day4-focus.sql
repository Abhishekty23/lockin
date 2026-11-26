-- LockIn Day 4: Lock In mode (focus sessions).
-- Run once in Supabase → SQL Editor.

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  label text check (char_length(label) <= 80),        -- what they worked on
  planned_minutes int not null check (planned_minutes between 1 and 240),
  actual_minutes int not null check (actual_minutes between 1 and 240),
  completed boolean not null default false,            -- ran the full timer
  distractions int not null default 0 check (distractions between 0 and 99),
  ambient text check (ambient in ('none', 'rain', 'cafe', 'forest', 'waves', 'brown')),
  started_at timestamptz not null,
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists focus_sessions_user_day on public.focus_sessions (user_id, day desc);

alter table public.focus_sessions enable row level security;

drop policy if exists "focus: read own or admin" on public.focus_sessions;
create policy "focus: read own or admin" on public.focus_sessions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "focus: insert own" on public.focus_sessions;
create policy "focus: insert own" on public.focus_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "focus: delete own" on public.focus_sessions;
create policy "focus: delete own" on public.focus_sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.focus_sessions from anon, authenticated;
grant select, insert, delete on public.focus_sessions to authenticated;

-- Clean-up: a day only counts as "locked" while its score is 100
-- (clears the flag left by the Day 3 live test).
update public.day_logs set locked_at = null where score < 100 and locked_at is not null;
