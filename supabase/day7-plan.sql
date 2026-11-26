-- LockIn Day 7: planning (goals, tasks, timetable, weekly plan).
-- Run once in Supabase → SQL Editor.

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  why text check (char_length(why) <= 280),
  emoji text not null default '🎯' check (char_length(emoji) <= 16),
  color text not null default 'violet' check (color in ('violet', 'cyan', 'amber', 'water', 'rose', 'mint')),
  target_date date,
  achieved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  done_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  priority smallint not null default 2 check (priority between 1 and 3),   -- 1 high, 2 normal, 3 low
  due date,
  estimate_minutes int check (estimate_minutes between 5 and 600),
  goal_id uuid references public.goals (id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_due on public.tasks (user_id, due);

create table if not exists public.timetable_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  start_min int not null check (start_min between 0 and 1439),
  end_min int not null check (end_min between 1 and 1440),
  title text not null check (char_length(title) between 1 and 60),
  kind text not null default 'study' check (kind in ('study', 'work', 'health', 'break', 'personal', 'other')),
  created_at timestamptz not null default now(),
  check (end_min > start_min)
);
create index if not exists blocks_user_day on public.timetable_blocks (user_id, day);

create table if not exists public.weekly_plans (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,                                  -- the Monday
  priorities text[] not null default '{}',
  wins text check (char_length(wins) <= 1000),
  lessons text check (char_length(lessons) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

-- Row Level Security: everyone sees and edits only their own plans (admins can read)
do $$
declare t text;
begin
  foreach t in array array['goals', 'milestones', 'tasks', 'timetable_blocks', 'weekly_plans'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: read own or admin" on public.%I', t, t);
    execute format('create policy "%s: read own or admin" on public.%I for select to authenticated using (user_id = (select auth.uid()) or public.is_admin())', t, t);
    execute format('drop policy if exists "%s: write own" on public.%I', t, t);
    execute format('create policy "%s: write own" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Milestones and tasks may only point at your own goals
drop policy if exists "milestones: write own" on public.milestones;
create policy "milestones: write own" on public.milestones for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid())));

drop policy if exists "tasks: write own" on public.tasks;
create policy "tasks: write own" on public.tasks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (goal_id is null or exists (select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid()))));
