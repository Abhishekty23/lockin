-- LockIn Day 2: accounts, profiles and roles.
-- Run once in Supabase → SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  avatar text not null default '🦉',
  role text not null default 'user' check (role in ('user', 'admin')),

  -- What they are working on
  tracks text[] not null default '{}',          -- skills, exam, career, fitness, reading, custom
  exam_name text,
  custom_track text,

  -- Their day
  wake_time time not null default '06:30',
  sleep_time time not null default '22:30',
  focus_goal_minutes int not null default 240 check (focus_goal_minutes between 15 and 960),
  water_goal int not null default 8 check (water_goal between 1 and 20),

  -- Alerts
  reminders jsonb not null default '{"water":true,"breaks":true,"eyes":true,"stretch":true,"sleep":true}',
  sound_on boolean not null default true,
  timezone text not null default 'Asia/Kolkata',

  onboarded boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile row for every new account (email or Google)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Is the current user an admin? (security definer avoids recursive RLS checks)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

-- Row Level Security
alter table public.profiles enable row level security;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Table access: users may edit their own settings but never their role, email or id.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (
  full_name, username, avatar, tracks, exam_name, custom_track,
  wake_time, sleep_time, focus_goal_minutes, water_goal,
  reminders, sound_on, timezone, onboarded, last_seen_at
) on public.profiles to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Is a username free? (callable before saving)
create or replace function public.username_available(name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.profiles where username = lower(name) and id <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;
grant execute on function public.username_available(text) to authenticated;
