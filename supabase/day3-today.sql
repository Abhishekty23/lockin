-- LockIn Day 3: one row per person per day for the Today dashboard.
-- Run once in Supabase → SQL Editor.

alter table public.profiles
  add column if not exists move_goal_minutes int not null default 30 check (move_goal_minutes between 5 and 300);
grant update (move_goal_minutes) on public.profiles to authenticated;

create table if not exists public.day_logs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  water int not null default 0 check (water between 0 and 40),
  focus_minutes int not null default 0 check (focus_minutes between 0 and 1440),
  sleep_minutes int check (sleep_minutes between 0 and 1440),   -- last night's sleep, logged in the morning
  move_minutes int not null default 0 check (move_minutes between 0 and 1440),
  mood smallint check (mood between 1 and 5),
  note text check (char_length(note) <= 280),                   -- one line about the day
  score smallint not null default 0 check (score between 0 and 100),
  locked_at timestamptz,                                        -- when the ring first hit 100
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

drop trigger if exists day_logs_touch on public.day_logs;
create trigger day_logs_touch before update on public.day_logs
  for each row execute function public.touch_updated_at();

alter table public.day_logs enable row level security;

drop policy if exists "day_logs: read own or admin" on public.day_logs;
create policy "day_logs: read own or admin" on public.day_logs
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "day_logs: insert own" on public.day_logs;
create policy "day_logs: insert own" on public.day_logs
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "day_logs: update own" on public.day_logs;
create policy "day_logs: update own" on public.day_logs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.day_logs from anon, authenticated;
grant select, insert, update on public.day_logs to authenticated;
