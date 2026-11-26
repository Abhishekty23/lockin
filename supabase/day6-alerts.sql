-- LockIn Day 6: alerts.
-- Run once in Supabase → SQL Editor.

-- How often each reminder repeats (minutes) and the extra smart alerts
alter table public.profiles
  add column if not exists alert_prefs jsonb not null default
    '{"water":75,"breaks":90,"eyes":30,"stretch":60,"morning":true,"evening":true,"desktop":false}';
grant update (alert_prefs) on public.profiles to authenticated;

-- What happened with each alert (used later by Insights and the admin panel)
create table if not exists public.alert_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('water', 'breaks', 'eyes', 'stretch', 'sleep', 'morning', 'evening')),
  action text not null check (action in ('shown', 'done', 'snoozed', 'skipped')),
  created_at timestamptz not null default now()
);
create index if not exists alert_events_user on public.alert_events (user_id, created_at desc);

alter table public.alert_events enable row level security;

drop policy if exists "alert_events: read own or admin" on public.alert_events;
create policy "alert_events: read own or admin" on public.alert_events
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "alert_events: insert own" on public.alert_events;
create policy "alert_events: insert own" on public.alert_events
  for insert to authenticated with check (user_id = (select auth.uid()));

revoke all on public.alert_events from anon, authenticated;
grant select, insert on public.alert_events to authenticated;
