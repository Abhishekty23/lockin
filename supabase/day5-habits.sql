-- LockIn Day 5: habits, steps and meals.
-- Run once in Supabase → SQL Editor.

-- Health check-ins on the daily log
alter table public.profiles
  add column if not exists steps_goal int not null default 8000 check (steps_goal between 1000 and 50000);
grant update (steps_goal) on public.profiles to authenticated;

alter table public.day_logs
  add column if not exists steps int not null default 0 check (steps between 0 and 100000),
  add column if not exists meals jsonb not null default '{}';   -- {"breakfast":"good","lunch":"okay",...}

-- Habits: the person's own checklist
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '✅' check (char_length(emoji) <= 16),
  color text not null default 'violet' check (color in ('violet', 'cyan', 'amber', 'water', 'rose', 'mint')),
  days smallint[] not null default '{0,1,2,3,4,5,6}',          -- 0 = Sunday … 6 = Saturday
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists habits_user on public.habits (user_id) where archived_at is null;

create table if not exists public.habit_checks (
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, day)
);
create index if not exists habit_checks_user_day on public.habit_checks (user_id, day desc);

alter table public.habits enable row level security;
alter table public.habit_checks enable row level security;

drop policy if exists "habits: read own or admin" on public.habits;
create policy "habits: read own or admin" on public.habits
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "habits: write own" on public.habits;
create policy "habits: write own" on public.habits
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "habit_checks: read own or admin" on public.habit_checks;
create policy "habit_checks: read own or admin" on public.habit_checks
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
-- A check can only point at one of your own habits
drop policy if exists "habit_checks: write own" on public.habit_checks;
create policy "habit_checks: write own" on public.habit_checks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );

revoke all on public.habits, public.habit_checks from anon, authenticated;
grant select, insert, update, delete on public.habits, public.habit_checks to authenticated;
