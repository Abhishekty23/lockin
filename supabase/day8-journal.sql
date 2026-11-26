-- LockIn Day 8: the journal. One entry per person per day.
-- Private by design: only the owner can read an entry. Admins can't (no is_admin() here).

create table if not exists public.journal_entries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  gratitude text[] not null default '{}' check (cardinality(gratitude) <= 3),
  win text check (char_length(win) <= 500),
  lesson text check (char_length(lesson) <= 500),
  tomorrow text check (char_length(tomorrow) <= 300),
  prompt text check (char_length(prompt) <= 200),
  body text check (char_length(body) <= 20000),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  words int not null default 0 check (words between 0 and 10000),
  starred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

drop trigger if exists journal_touch on public.journal_entries;
create trigger journal_touch before update on public.journal_entries
  for each row execute function public.touch_updated_at();

alter table public.journal_entries enable row level security;

drop policy if exists "journal: read own" on public.journal_entries;
create policy "journal: read own" on public.journal_entries
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "journal: insert own" on public.journal_entries;
create policy "journal: insert own" on public.journal_entries
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "journal: update own" on public.journal_entries;
create policy "journal: update own" on public.journal_entries
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "journal: delete own" on public.journal_entries;
create policy "journal: delete own" on public.journal_entries
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.journal_entries from anon, authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;

-- A full journal entry also fills the Journal part of the day ring
alter table public.day_logs add column if not exists journaled boolean not null default false;
